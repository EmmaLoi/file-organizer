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

export class Cleanup extends EventEmitter {
    async cleanup(directory, olderThanDays, confirm = false) {
        try {
            this.emit('cleanup-start', { directory, olderThanDays });

            const entries = await fs.readdir(directory, { recursive: true });
            const oldFiles = [];

            for (const entry of entries) {
                const filePath = path.join(directory, entry);
                const stats = await fs.stat(filePath);

                if (!stats.isFile()) continue;

                const age = daysAgo(stats.mtime);

                if (age > olderThanDays) {
                    const file = {
                        path: filePath,
                        name: path.basename(filePath),
                        size: stats.size,
                        formattedSize: formatSize(stats.size),
                        mtime: stats.mtime,
                        age
                    };

                    oldFiles.push(file);
                    this.emit('file-found', { file });
                }
            }

            const totalSize = oldFiles.reduce((sum, file) => sum + file.size, 0);

            this.emit('files-ready', {
                files: oldFiles,
                totalSize,
                formattedSize: formatSize(totalSize),
                confirm
            });

            if (!confirm) {
                this.emit('cleanup-complete', {
                    deleted: 0,
                    freed: 0,
                    formattedFreed: formatSize(0),
                    dryRun: true
                });
                return;
            }

            let deleted = 0;
            let freed = 0;

            for (const file of oldFiles) {
                await fs.unlink(file.path);

                deleted++;
                freed += file.size;

                this.emit('file-deleted', {
                    current: deleted,
                    total: oldFiles.length,
                    file
                });
            }

            this.emit('cleanup-complete', {
                deleted,
                freed,
                formattedFreed: formatSize(freed),
                dryRun: false
            });
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.error(`Error: Directory or file not found: ${directory}`);
            } else if (error.code === 'EACCES') {
                console.error(`Error: Permission denied: ${directory}`);
            } else {
                console.error(`Unexpected error: ${error.message}`);
            }

            process.exit(1);
        }
    }
}