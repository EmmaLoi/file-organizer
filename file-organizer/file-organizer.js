import { Scanner, formatSize, daysAgo } from './lib/scanner.js';
import { DuplicateFinder } from './lib/duplicates.js';
import { Organizer } from './lib/organizer.js';
import { Cleanup } from './lib/cleanup.js';

const command = process.argv[2];
const directory = process.argv[3];

if (!command || !directory) {
    console.log('Usage: node file-organizer.js <command> <directory>');
    console.log('Commands: scan, duplicates, organize, cleanup');
    process.exit(1);
}

if (command === 'scan') {
    const scanner = new Scanner();

    scanner.on('scan-start', ({ directory }) => {
        console.log(`Scanning: ${directory}`);
    });

    scanner.on('file-found', ({ current, total }) => {
        process.stdout.write(`\rProcessing... ${current}/${total} files`);
    });

    scanner.on('scan-complete', (stats) => {
        console.log('\n');
        console.log('Scan Results:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Total files: ${stats.totalFiles}`);
        console.log(`Total size: ${stats.formattedSize}`);

        console.log('\nBy File Type:');
        for (const [extension, data] of stats.byType) {
            console.log(`  ${extension}  ${data.count} files  ${formatSize(data.totalSize)}`);
        }

        console.log('\nFile Age:');
        console.log(`  Last 7 days:    ${stats.age.last7Days} files`);
        console.log(`  Last 30 days:   ${stats.age.last30Days} files`);
        console.log(`  Older than 90:  ${stats.age.olderThan90Days} files`);

        console.log('\nLargest files:');
        stats.largestFiles.forEach((file, index) => {
            console.log(`  ${index + 1}. ${file.name}  ${formatSize(file.size)}`);
        });

        if (stats.oldestFile) {
            console.log(
                `\nOldest file: ${stats.oldestFile.name} ` +
                `(modified ${daysAgo(stats.oldestFile.mtime)} days ago)`
            );
        }
    });

    await scanner.scan(directory);

} else if (command === 'duplicates') {
    const finder = new DuplicateFinder();

    finder.on('start', ({ directory }) => {
        console.log(`Searching for duplicates in: ${directory}`);
    });

    finder.on('file-processed', ({ current, total }) => {
        process.stdout.write(`\rCalculating hashes... ${current}/${total}`);
    });

    finder.on('duplicates-found', (data) => {
        console.log('\n');

        if (data.duplicates.length === 0) {
            console.log('No duplicates found');
            return;
        }

        console.log(
            `Found ${data.duplicates.length} duplicate groups (${data.formattedWasted} wasted):`
        );

        data.duplicates.forEach((group, index) => {
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`Group ${index + 1} (${group.files.length} copies):`);
            console.log(`SHA-256: ${group.hash.slice(0, 16)}...`);

            group.files.forEach((file) => {
                console.log(`${file.path}`);
            });

            console.log(`Wasted space: ${formatSize(group.wasted)}`);
        });

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Total wasted space: ${data.formattedWasted}`);
    });

    await finder.find(directory);

} else if (command === 'organize') {
    const outputIndex = process.argv.indexOf('--output');
    const targetDirectory = outputIndex !== -1 ? process.argv[outputIndex + 1] : null;

    if (!targetDirectory) {
        console.log('Usage: node file-organizer.js organize <source> --output <target>');
        process.exit(1);
    }

    const organizer = new Organizer();

    organizer.on('organize-start', ({ sourceDirectory, targetDirectory }) => {
        console.log(`Organizing: ${sourceDirectory}`);
        console.log(`Target: ${targetDirectory}`);
        console.log('\nCreating folders...');
    });

    organizer.on('folder-created', ({ category }) => {
        console.log(`Created: ${category}/`);
    });

    organizer.on('copy-complete', ({ current, total }) => {
        process.stdout.write(`\rCopying files... ${current}/${total}`);
    });

    organizer.on('organize-complete', (data) => {
        console.log('\n\nOrganization complete!');
        console.log('\nSummary:');

        for (const [category, info] of Object.entries(data.summary)) {
            console.log(`  ${category}: ${info.count} files`);
        }

        console.log(`\nTotal copied: ${data.copied} files (${data.formattedSize})`);
    });

    await organizer.organize(directory, targetDirectory);

} else if (command === 'cleanup') {
    const olderThanIndex = process.argv.indexOf('--older-than');
    const olderThanDays = olderThanIndex !== -1
        ? Number(process.argv[olderThanIndex + 1])
        : null;

    const confirm = process.argv.includes('--confirm');

    if (olderThanDays === null || Number.isNaN(olderThanDays)) {
        console.log('Usage: node file-organizer.js cleanup <directory> --older-than <days> [--confirm]');
        process.exit(1);
    }

    const cleaner = new Cleanup();

    cleaner.on('cleanup-start', ({ directory, olderThanDays }) => {
        console.log(`Cleanup: ${directory}`);
        console.log(`Looking for files older than ${olderThanDays} days...`);
    });

    cleaner.on('files-ready', ({ files, formattedSize, confirm }) => {
        console.log(`\nFound ${files.length} files to delete:`);

        files.slice(0, 10).forEach((file) => {
            console.log(`\n${file.name}`);
            console.log(`  Size: ${file.formattedSize}`);
            console.log(`  Modified: ${file.age} days ago`);
        });

        if (files.length > 10) {
            console.log(`\n... (${files.length - 10} more files)`);
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Total: ${files.length} files (${formattedSize})`);

        if (!confirm) {
            console.log('\nDRY RUN MODE: No files were deleted.');
            console.log('To actually delete these files, run with --confirm flag.');
        } else {
            console.log(`\nDELETING ${files.length} files (${formattedSize}).`);
        }
    });

    cleaner.on('file-deleted', ({ current, total }) => {
        process.stdout.write(`\rDeleting... ${current}/${total}`);
    });

    cleaner.on('cleanup-complete', ({ deleted, formattedFreed, dryRun }) => {
        if (dryRun) return;

        console.log('\n\nCleanup complete!');
        console.log(`Deleted: ${deleted} files (${formattedFreed} freed)`);
    });

    await cleaner.cleanup(directory, olderThanDays, confirm);

} else {
    console.log(`Unknown command: ${command}`);
}