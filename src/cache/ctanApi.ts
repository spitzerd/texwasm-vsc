import * as fs from "node:fs";
import * as http from "node:http";
import * as https from "node:https";
import * as path from "node:path";
import * as zlib from "node:zlib";
import * as tar from "tar";
import AdmZip from "adm-zip";

const CTAN_JSON_API = "https://www.ctan.org/json/2.0";
const CTAN_MIRROR = "https://mirrors.ctan.org";
const REQUEST_TIMEOUT = 30000;

// Connection pool — reuse TCP connections to CTAN mirrors across requests
const HTTPS_AGENT = new https.Agent({ keepAlive: true, maxSockets: 10 });
const HTTP_AGENT = new http.Agent({ keepAlive: true, maxSockets: 10 });

export interface CtanPackageInfo {
	name: string;
	title?: string;
	version?: string;
	license?: string | string[];
	ctan?: {
		path?: string;
		version?: string;
	};
	install?: string;
	copyright?: { maintenance?: string; status?: string }[];
}

interface CtanApiResponse {
	error?: string;
	name?: string;
	version?: string;
	title?: string;
	license?: string | string[];
	ctan?: { path?: string; version?: string };
	install?: string;
	copyright?: { maintenance?: string; status?: string }[];
}

function httpsGet(url: string, depth = 0): Promise<string> {
	if (depth > 5) throw new Error(`Too many redirects: ${url}`);
	return new Promise((resolve, reject) => {
		const protocol = url.startsWith("https") ? https : http;
		const agent = url.startsWith("https") ? HTTPS_AGENT : HTTP_AGENT;
		const req = protocol.get(url, { timeout: REQUEST_TIMEOUT, agent }, (res) => {
			if (res.statusCode && res.statusCode >= 301 && res.statusCode <= 308) {
				const location = res.headers.location;
				if (location) {
					const nextUrl = location.startsWith("http")
						? location
						: new URL(location, url).href;
					httpsGet(nextUrl, depth + 1).then(resolve, reject);
					return;
				}
			}
			if (res.statusCode !== 200) {
				reject(new Error(`HTTP ${res.statusCode} for ${url}`));
				return;
			}
			const chunks: Buffer[] = [];
			res.on("data", (chunk: Buffer) => chunks.push(chunk));
			res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
		});
		req.on("error", reject);
		req.on("timeout", () => {
			req.destroy();
			reject(new Error(`Request timed out: ${url}`));
		});
	});
}

export async function queryPackageInfo(
	packageName: string,
): Promise<CtanPackageInfo | null> {
	try {
		const url = `${CTAN_JSON_API}/pkg/${encodeURIComponent(packageName)}`;
		const body = await httpsGet(url);
		const data: CtanApiResponse = JSON.parse(body);
		if (data.error) return null;
		return {
			name: data.name || packageName,
			title: data.title,
			version: data.version,
			license: data.license,
			ctan: data.ctan,
			install: data.install,
		};
	} catch {
		return null;
	}
}

export function getTdsDownloadUrl(pkgInfo: CtanPackageInfo): string | null {
	if (pkgInfo.install) {
		return `${CTAN_MIRROR}/install${pkgInfo.install}`;
	}
	const ctanPath = pkgInfo.ctan?.path;
	if (!ctanPath) return null;
	return `${CTAN_MIRROR}/install${ctanPath}.tds.zip`;
}

/** Fallback source zip URL (non-TDS) for packages without a TDS archive */
export function getSourceZipUrl(pkgInfo: CtanPackageInfo): string | null {
	const ctanPath = pkgInfo.ctan?.path;
	if (!ctanPath) return null;
	return `${CTAN_MIRROR}${ctanPath}.zip`;
}

function collectBuffer(
	res: http.IncomingMessage,
): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		res.on("data", (chunk: Buffer) => chunks.push(chunk));
		res.on("end", () => resolve(Buffer.concat(chunks)));
		res.on("error", reject);
	});
}

async function downloadToBuffer(
	downloadUrl: string,
	depth = 0,
): Promise<Buffer> {
	if (depth > 5) throw new Error(`Too many redirects: ${downloadUrl}`);
	const protocol = downloadUrl.startsWith("https") ? https : http;
	const agent = downloadUrl.startsWith("https") ? HTTPS_AGENT : HTTP_AGENT;
	return new Promise<Buffer>((resolve, reject) => {
		protocol
			.get(downloadUrl, { timeout: REQUEST_TIMEOUT, agent }, (res) => {
				if (res.statusCode && res.statusCode >= 301 && res.statusCode <= 308) {
					const location = res.headers.location;
					if (location) {
						const nextUrl = location.startsWith("http")
							? location
							: new URL(location, downloadUrl).href;
						downloadToBuffer(nextUrl, depth + 1).then(resolve, reject);
						return;
					}
				}
				if (res.statusCode !== 200) {
					reject(new Error(`HTTP ${res.statusCode} for ${downloadUrl}`));
					return;
				}
				collectBuffer(res).then(resolve, reject);
			})
			.on("error", reject);
	});
}

/** Number of download attempts per URL. mirrors.ctan.org redirects to a
 *  (mostly) different mirror on each attempt, so retries tolerate flaky mirrors. */
const DOWNLOAD_ATTEMPTS = 3;

export async function downloadTdsPackage(
	downloadUrl: string,
	destDir: string,
	packageName?: string,
): Promise<string[]> {
	let buffer: Buffer | undefined;
	let lastError: unknown;
	for (let attempt = 0; attempt < DOWNLOAD_ATTEMPTS; attempt++) {
		try {
			buffer = await downloadToBuffer(downloadUrl);
			break;
		} catch (err) {
			lastError = err;
		}
	}
	if (buffer === undefined) {
		throw lastError instanceof Error
			? lastError
			: new Error(`Download failed: ${downloadUrl}`);
	}

	if (downloadUrl.endsWith(".zip")) {
		const zip = new AdmZip(buffer);
		zip.extractAllTo(destDir, true);
	} else {
		const gunzip = zlib.createGunzip();
		await new Promise<void>((resolve, reject) => {
			const extractor = tar.extract({ cwd: destDir });
			extractor.on("finish", () => resolve());
			extractor.on("error", reject);
			gunzip.pipe(extractor);
			gunzip.end(buffer);
		});
	}

	// If the zip was a source zip (not a TDS archive), the files are
	// inside a top-level subdirectory named after the package.  Flatten
	// it so the directory structure mirrors a TDS archive (no top-level
	// wrapper).
	if (packageName) {
		const packageDir = path.join(destDir, packageName);
		if (fs.existsSync(packageDir) && fs.statSync(packageDir).isDirectory()) {
			const innerFiles = walkDirectory(packageDir);
			for (const f of innerFiles) {
				const rel = path.relative(packageDir, f);
				const target = path.join(destDir, rel);
				const targetDir = path.dirname(target);
				if (!fs.existsSync(targetDir)) {
					fs.mkdirSync(targetDir, { recursive: true });
				}
				fs.renameSync(f, target);
			}
			fs.rmSync(packageDir, { recursive: true, force: true });
		}
	}

	return walkDirectory(destDir);
}

function walkDirectory(dir: string): string[] {
	const files: string[] = [];
	try {
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				files.push(...walkDirectory(full));
			} else {
				files.push(full);
			}
		}
	} catch {}
	return files;
}
