


const fs = require('fs');
const path = require('path');
const https = require('https');
const readline = require('readline');


const m3u8File = process.argv[2];
if (!m3u8File) {
  console.error('Usage: node ts-downloader.js <fichier-m3u8>');
  process.exit(1);
}


const outputDir = path.join(path.dirname(m3u8File), 'segments');
const outputFile = path.join(path.dirname(m3u8File), path.basename(m3u8File, '.m3u8') + '.ts');

try {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
} catch (error) {
  console.error('Erreur lors de la création du dossier segments:', error);
  process.exit(1);
}


const content = fs.readFileSync(m3u8File, 'utf8');
const lines = content.split('\n');


const segments = [];
for (const line of lines) {
  if (line.trim() && line.indexOf('http') === 0 && line.endsWith('.ts')) {
    segments.push(line.trim());
  }
}

if (segments.length === 0) {
  console.error('Aucun segment trouvé dans le fichier M3U8');
  process.exit(1);
}

console.log(`Nombre total de segments: ${segments.length}`);


function downloadSegment(url, outputPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Erreur HTTP ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(outputPath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', (err) => {
        fs.unlink(outputPath, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}


async function downloadAllSegments() {

  const combinedFile = fs.createWriteStream(outputFile);
  

  let completed = 0;
  const total = segments.length;
  const updateProgress = () => {
    const percent = Math.round((completed / total) * 100);
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(`Progression: ${completed}/${total} (${percent}%)`);
  };
  

  for (let i = 0; i < segments.length; i++) {
    const segmentUrl = segments[i];
    const segmentPath = path.join(outputDir, `segment_${i}.ts`);
    
    try {

      await downloadSegment(segmentUrl, segmentPath);
      

      const segmentData = fs.readFileSync(segmentPath);
      combinedFile.write(segmentData);
      

      fs.unlinkSync(segmentPath);
      

      completed++;
      updateProgress();
      
    } catch (error) {
      console.error(`\nErreur lors du téléchargement du segment ${i}:`, error.message);

    }
  }
  
  combinedFile.end();
  console.log(`\nTéléchargement terminé. Fichier enregistré: ${outputFile}`);
}


downloadAllSegments().catch(err => {
  console.error('\nErreur:', err);
});
