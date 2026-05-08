import { EventEmitter } from 'events';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';

const LARGE_FILE_SIZE = 10 * 1024 * 1024;

const categories = {
    Documents: ['.pdf', '.docx', '.doc', '.txt', '.md', '.xlsx', '.pptx'],
    Images: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp'],
    Archives: ['.zip', '.rar', '.tar', '.gz', '.7z'],
    Code: ['.js', '.py', '.java', '.cpp', '.html', '.css', '.json'],
    Videos: ['.mp4', '.avi', '.mkv', '.mov', '.webm'],
    Other: []
};

function getCategory(extension) {
    for (const [category, extensions] of Object.entries(categories)) {
        if (extensions.includes(extension)) return category;
    }

    return 'Other';
}

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function pathExists(filePath) {
    try {
        await fsp.access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function getUniqueTargetPath(targetPath) {
    if (!(await pathExists(targetPath))) return targetPath;

    const dir = path.dirname(targetPath);
    const extension = path.extname(targetPath);
    const baseName = path.basename(targetPath, extension);

    let counter = 1;
    let newPath;

    do {
        newPath = path.join(dir, `${baseName}(${counter})${extension}`);
        counter++;
    } while (await pathExists(newPath));

    return newPath;
}

async function copyFileSmart(sourcePath, targetPath, size) {
    if (size >= LARGE_FILE_SIZE) {
        await pipeline(
            fs.createReadStream(sourcePath),
            fs.createWriteStream(targetPath)
        );
    } else {
        await fsp.copyFile(sourcePath, targetPath);
    }
}

export class Organizer extends EventEmitter {
    async organize(sourceDirectory, targetDirectory) {
        try {
            this.emit('organize-start', { sourceDirectory, targetDirectory });

            for (const category of Object.keys(categories)) {
                const categoryPath = path.join(targetDirectory, category);
                await fsp.mkdir(categoryPath, { recursive: true });
                this.emit('folder-created', { category, path: categoryPath });
            }

            const entries = await fsp.readdir(sourceDirectory, { recursive: true });
            const files = [];

            for (const entry of entries) {
                const sourcePath = path.join(sourceDirectory, entry);
                const stats = await fsp.stat(sourcePath);

                if (stats.isFile()) {
                    files.push({
                        sourcePath,
                        name: path.basename(sourcePath),
                        extension: path.extname(sourcePath).toLowerCase(),
                        size: stats.size
                    });
                }
            }

            const summary = {};
            for (const category of Object.keys(categories)) {
                summary[category] = {
                    count: 0,
                    size: 0
                };
            }

            let copied = 0;
            let totalSize = 0;

            for (const file of files) {
                const category = getCategory(file.extension);
                const categoryPath = path.join(targetDirectory, category);
                const targetPath = await getUniqueTargetPath(
                    path.join(categoryPath, file.name)
                );

                this.emit('copy-start', { file, category });

                await copyFileSmart(file.sourcePath, targetPath, file.size);

                copied++;
                totalSize += file.size;
                summary[category].count++;
                summary[category].size += file.size;

                this.emit('copy-complete', {
                    current: copied,
                    total: files.length,
                    file,
                    category,
                    targetPath
                });
            }

            this.emit('organize-complete', {
                copied,
                totalSize,
                formattedSize: formatSize(totalSize),
                summary,
                targetDirectory
            });
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.error('Error: Directory or file not found.');
            } else if (error.code === 'EACCES') {
                console.error('Error: Permission denied.');
            } else {
                console.error(`Unexpected error: ${error.message}`);
            }

            process.exit(1);
        }
    }
}