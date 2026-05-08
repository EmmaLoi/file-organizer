import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function daysAgo(date) {
    return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

export class Scanner extends EventEmitter {
    async scan(directory) {
        try {
            const entries = await fs.readdir(directory, { recursive: true });
            const files = [];

            for (const entry of entries) {
                const filePath = path.join(directory, entry);
                const stats = await fs.stat(filePath);

                if (stats.isFile()) {
                    files.push({
                        path: filePath,
                        name: path.basename(filePath),
                        extension: path.extname(filePath).toLowerCase() || '(no extension)',
                        size: stats.size,
                        mtime: stats.mtime
                    });
                }
            }

            this.emit('scan-start', { directory });

            const byType = new Map();
            const age = {
                last7Days: 0,
                last30Days: 0,
                olderThan90Days: 0
            };

            let totalSize = 0;
            let oldestFile = null;

            files.forEach((file, index) => {
                totalSize += file.size;

                const currentType = byType.get(file.extension) || {
                    count: 0,
                    totalSize: 0
                };

                currentType.count++;
                currentType.totalSize += file.size;
                byType.set(file.extension, currentType);

                const fileAge = daysAgo(file.mtime);

                if (fileAge <= 7) age.last7Days++;
                if (fileAge <= 30) age.last30Days++;
                if (fileAge > 90) age.olderThan90Days++;

                if (!oldestFile || file.mtime < oldestFile.mtime) {
                    oldestFile = file;
                }

                this.emit('file-found', {
                    current: index + 1,
                    total: files.length,
                    file
                });
            });

            const largestFiles = [...files]
                .sort((a, b) => b.size - a.size)
                .slice(0, 3);

            this.emit('scan-complete', {
                totalFiles: files.length,
                totalSize,
                formattedSize: formatSize(totalSize),
                byType,
                age,
                largestFiles,
                oldestFile
            });
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.error(`Error: Directory not found: ${directory}`);
            } else if (error.code === 'EACCES') {
                console.error(`Error: Permission denied: ${directory}`);
            } else {
                console.error(`Unexpected error: ${error.message}`);
            }

            process.exit(1);
        }
    }
}

export { formatSize, daysAgo };