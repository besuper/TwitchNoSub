const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sharedFiles = [
    "LICENSE",
    "README.md",
    "assets/icons/icon.png",
    "src/app.js",
    "src/patch_amazonworker.js",
    "src/restriction-remover.js"
];

function createCrcTable() {
    const table = new Uint32Array(256);

    for (let index = 0; index < 256; index += 1) {
        let value = index;
        for (let bit = 0; bit < 8; bit += 1) {
            value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
        }
        table[index] = value >>> 0;
    }

    return table;
}

const crcTable = createCrcTable();

function crc32(buffer) {
    let value = 0xFFFFFFFF;
    for (const byte of buffer) value = crcTable[(value ^ byte) & 0xFF] ^ (value >>> 8);
    return (value ^ 0xFFFFFFFF) >>> 0;
}

function createPackageEntries(manifestFile) {
    const entries = [{
        name: "manifest.json",
        data: fs.readFileSync(path.join(root, manifestFile))
    }];

    for (const file of sharedFiles) {
        entries.push({ name: file.replaceAll("\\", "/"), data: fs.readFileSync(path.join(root, file)) });
    }

    return entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
}

function buildZip(entries) {
    const localParts = [];
    const centralParts = [];
    let localOffset = 0;
    const dosDate = 0x0021; // 1980-01-01, the earliest ZIP timestamp.

    for (const entry of entries) {
        const name = Buffer.from(entry.name, "utf8");
        const data = Buffer.from(entry.data);
        const checksum = crc32(data);

        const localHeader = Buffer.alloc(30);
        localHeader.writeUInt32LE(0x04034B50, 0);
        localHeader.writeUInt16LE(20, 4);
        localHeader.writeUInt16LE(0x0800, 6);
        localHeader.writeUInt16LE(0, 8);
        localHeader.writeUInt16LE(0, 10);
        localHeader.writeUInt16LE(dosDate, 12);
        localHeader.writeUInt32LE(checksum, 14);
        localHeader.writeUInt32LE(data.length, 18);
        localHeader.writeUInt32LE(data.length, 22);
        localHeader.writeUInt16LE(name.length, 26);
        localHeader.writeUInt16LE(0, 28);

        localParts.push(localHeader, name, data);

        const centralHeader = Buffer.alloc(46);
        centralHeader.writeUInt32LE(0x02014B50, 0);
        centralHeader.writeUInt16LE(20, 4);
        centralHeader.writeUInt16LE(20, 6);
        centralHeader.writeUInt16LE(0x0800, 8);
        centralHeader.writeUInt16LE(0, 10);
        centralHeader.writeUInt16LE(0, 12);
        centralHeader.writeUInt16LE(dosDate, 14);
        centralHeader.writeUInt32LE(checksum, 16);
        centralHeader.writeUInt32LE(data.length, 20);
        centralHeader.writeUInt32LE(data.length, 24);
        centralHeader.writeUInt16LE(name.length, 28);
        centralHeader.writeUInt16LE(0, 30);
        centralHeader.writeUInt16LE(0, 32);
        centralHeader.writeUInt16LE(0, 34);
        centralHeader.writeUInt16LE(0, 36);
        centralHeader.writeUInt32LE(0, 38);
        centralHeader.writeUInt32LE(localOffset, 42);
        centralParts.push(centralHeader, name);

        localOffset += localHeader.length + name.length + data.length;
    }

    const centralDirectory = Buffer.concat(centralParts);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054B50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralDirectory.length, 12);
    end.writeUInt32LE(localOffset, 16);
    end.writeUInt16LE(0, 20);

    return Buffer.concat([...localParts, centralDirectory, end]);
}

function listZipEntries(archive) {
    const entries = [];
    let offset = 0;

    while (offset + 30 <= archive.length && archive.readUInt32LE(offset) === 0x04034B50) {
        const dataLength = archive.readUInt32LE(offset + 18);
        const nameLength = archive.readUInt16LE(offset + 26);
        const extraLength = archive.readUInt16LE(offset + 28);
        const nameStart = offset + 30;
        entries.push(archive.subarray(nameStart, nameStart + nameLength).toString("utf8"));
        offset = nameStart + nameLength + extraLength + dataLength;
    }

    return entries;
}

function sha256(buffer) {
    return crypto.createHash("sha256").update(buffer).digest("hex");
}

function buildPackages(outDir) {
    const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
    const outputs = [
        { manifest: "manifest.json", name: `twitchnosub-chromium-${version}.zip` },
        { manifest: "firefox-manifest.json", name: `twitchnosub-firefox-${version}-unsigned.xpi` }
    ];

    fs.mkdirSync(outDir, { recursive: true });
    const checksums = [];

    for (const output of outputs) {
        const archive = buildZip(createPackageEntries(output.manifest));
        fs.writeFileSync(path.join(outDir, output.name), archive);
        checksums.push(`${sha256(archive)}  ${output.name}`);
    }

    fs.writeFileSync(path.join(outDir, "SHA256SUMS.txt"), `${checksums.join("\n")}\n`);
    return outputs.map(output => output.name);
}

if (require.main === module) {
    const outArgument = process.argv.indexOf("--out-dir");
    const outDir = outArgument >= 0 && process.argv[outArgument + 1]
        ? path.resolve(process.argv[outArgument + 1])
        : path.join(root, "dist");

    const outputs = buildPackages(outDir);
    console.log(`Built ${outputs.join(" and ")} in ${outDir}`);
}

module.exports = { buildPackages, buildZip, createPackageEntries, listZipEntries };
