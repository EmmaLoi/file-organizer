import { EventEmitter } from 'events';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function calculateHash(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);

        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

export class DuplicateFinder extends EventEmitter {
    async find(directory) {
        try {
            const entries = await fsp.readdir(directory, { recursive: true });

            const files = [];

            for (const entry of entries) {
                const filePath = path.join(directory, entry);
                const stats = await fsp.stat(filePath);

                if (stats.isFile()) {
                    files.push({ path: filePath, size: stats.size });
                }
            }

            this.emit('start', { directory });

            const hashMap = new Map();
            let current = 0;

            for (const file of files) {
                current++;

                const hash = await calculateHash(file.path);

                if (!hashMap.has(hash)) {
                    hashMap.set(hash, []);
                }

                hashMap.get(hash).push(file);

                this.emit('file-processed', {
                    current,
                    total: files.length
                });
            }

            const duplicates = [];
            let totalWasted = 0;

            for (const [hash, fileList] of hashMap) {
                if (fileList.length > 1) {
                    const wasted = fileList[0].size * (fileList.length - 1);
                    totalWasted += wasted;

                    duplicates.push({
                        hash,
                        files: fileList,
                        wasted
                    });
                }
            }

            this.emit('duplicates-found', {
                duplicates,
                totalWasted,
                formattedWasted: formatSize(totalWasted)
            });

        } catch (error) {
            console.error(`Error: ${error.message}`);
            process.exit(1);
        }
    }
}