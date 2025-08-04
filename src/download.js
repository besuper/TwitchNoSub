

(function() {

    let downloadButtonAdded = false;


    function getVodId() {
        const match = window.location.pathname.match(/\/videos\/(\d+)/);
        return match ? match[1] : null;
    }


    async function getVodInfo(vodId) {

        const vodInfo = {
            m3u8Url: null,
            title: null
        };


        const videoElements = document.querySelectorAll('video');
        for (const video of videoElements) {
            if (video.src && video.src.includes('.m3u8')) {
                vodInfo.m3u8Url = video.src;


                const titleElement = document.querySelector('h1[data-a-target="stream-title"], .tw-title');
                if (titleElement) {
                    vodInfo.title = titleElement.textContent.trim();
                }

                return vodInfo;
            }
        }


        try {

            const resp = await fetch("https://gql.twitch.tv/gql", {
                method: 'POST',
                body: JSON.stringify({
                    "query": "query { video(id: \"" + vodId + "\") { seekPreviewsURL, title, owner { login } }}"
                }),
                headers: {
                    'Client-Id': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            const data = await resp.json();
            if (data && data.data && data.data.video) {
                const vodData = data.data.video;
                const currentURL = new URL(vodData.seekPreviewsURL);
                const domain = currentURL.host;
                const paths = currentURL.pathname.split("/");
                const vodSpecialID = paths[paths.findIndex(element => element.includes("storyboards")) - 1];


                vodInfo.m3u8Url = `https://${domain}/${vodSpecialID}/chunked/index-dvr.m3u8`;
                vodInfo.title = vodData.title;

                return vodInfo;
            }
        } catch (e) {
            console.error("Error getting VOD info:", e);
        }

        return vodInfo;
    }


    function createSafeFilename(title, vodId) {
        if (!title) return `twitch_vod_${vodId}`;


        let safeTitle = title
            .replace(/[\\/:*?"<>|]/g, '_')
            .replace(/\s+/g, '_')
            .replace(/__+/g, '_')
            .substring(0, 100);


        return `${safeTitle}_${vodId}`;
    }


    async function getFixedM3u8Content(m3u8Url) {
        try {
            const response = await fetch(m3u8Url);
            const content = await response.text();


            const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);


            const lines = content.split('\n');
            const fixedLines = lines.map(line => {
                if (line.endsWith('.ts') || (line.endsWith('.m3u8') && !line.startsWith('#'))) {
                    return baseUrl + line;
                }
                return line;
            });

            return fixedLines.join('\n');
        } catch (error) {
            console.error('Error fixing M3U8:', error);
            return null;
        }
    }


    function createDownloadButton() {
        if (downloadButtonAdded) return;

        const vodId = getVodId();
        if (!vodId) return;


        let safeFilename = `twitch_vod_${vodId}`;


        const controlsContainer = document.querySelector('.player-controls__right-control-group') ||
            document.querySelector('.ScCoreButton-sc-ocjdkq-0');

        if (!controlsContainer) {

            setTimeout(createDownloadButton, 1000);
            return;
        }


        const downloadDialog = document.createElement('div');
        downloadDialog.style.display = 'none';
        downloadDialog.style.position = 'fixed';
        downloadDialog.style.left = '50%';
        downloadDialog.style.top = '50%';
        downloadDialog.style.transform = 'translate(-50%, -50%)';
        downloadDialog.style.backgroundColor = '#18181b';
        downloadDialog.style.border = '1px solid #3a3a3d';
        downloadDialog.style.borderRadius = '6px';
        downloadDialog.style.padding = '20px';
        downloadDialog.style.zIndex = '9999';
        downloadDialog.style.width = '500px';
        downloadDialog.style.maxHeight = '80vh';
        downloadDialog.style.overflowY = 'auto';
        downloadDialog.style.color = 'white';
        downloadDialog.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';

        downloadDialog.innerHTML = `
            <h3 style="margin-top: 0; font-size: 18px; border-bottom: 1px solid #3a3a3d; padding-bottom: 10px;">Télécharger la VOD</h3>
            <div style="margin-bottom: 15px;">
                <p style="margin-bottom: 15px;">Choisissez une option de téléchargement :</p>
                
                <button id="directM3u8" style="background: #9147ff; border: none; color: white; padding: 8px 15px; border-radius: 4px; cursor: pointer; margin-right: 10px; font-weight: bold;">Télécharger M3U8</button>
                
                <div id="downloadHelp" style="margin-top: 20px; background: #242426; padding: 15px; border-radius: 4px; display: none;">
                    
                    <div style="margin-top: 15px; border-top: 1px solid #3a3a3d; padding-top: 15px;">
                        <p>1. <a href="#" id="downloadScript" style="color: #bf94ff;">Télécharger le script ts-downloader.js</a></p>
                        <p>2. Exécutez avec Node.js :</p>
                        <div style="background: #0e0e10; padding: 10px; border-radius: 4px; font-family: monospace; margin: 10px 0; white-space: nowrap; overflow-x: auto;">
                            <code id="nodeCmd" style="color: #ddd;">node ts-downloader.js ${safeFilename}.m3u8</code>
                        </div>
                        <button id="copyNode" style="background: #3a3a3d; border: none; color: white; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Copier la commande</button>
                        
                        <p style="margin-top: 15px;">3. Après avoir obtenu le fichier .ts, convertissez-le en MP4 avec FFmpeg en ligne de commande <button id="ffmpegHelp" style="background: #3a3a3d; border: none; color: white; border-radius: 50%; width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; font-size: 12px; margin-left: 5px;">?</button> :</p>
                        
                        <div id="ffmpegInstallGuide" style="display: none; background: #242426; padding: 10px; border-radius: 4px; margin: 10px 0; font-size: 13px;">
                            <div style="display: flex; border-bottom: 1px solid #3a3a3d; margin-bottom: 10px;">
                                <button class="os-tab active" data-os="windows" style="background: none; border: none; color: white; padding: 5px 10px; cursor: pointer; border-bottom: 2px solid transparent;">Windows</button>
                                <button class="os-tab" data-os="macos" style="background: none; border: none; color: white; padding: 5px 10px; cursor: pointer; border-bottom: 2px solid transparent;">macOS</button>
                                <button class="os-tab" data-os="linux" style="background: none; border: none; color: white; padding: 5px 10px; cursor: pointer; border-bottom: 2px solid transparent;">Linux</button>
                            </div>
                            
                            <div class="os-content" id="windows-content" style="display: block;">
                                <p>1. <a href="https://github.com/BtbN/FFmpeg-Builds/releases" target="_blank" style="color: #bf94ff;">Téléchargez FFmpeg pour Windows</a> (choisissez la version <code>ffmpeg-master-latest-win64-gpl.zip</code>)</p>
                                <p>2. Extrayez le fichier ZIP dans un dossier (ex: <code>C:\\ffmpeg</code>)</p>
                                <p>3. Ajoutez le dossier <code>bin</code> au PATH Windows:</p>
                                <ul style="padding-left: 15px; margin: 5px 0;">
                                    <li>Recherchez "variables d'environnement" dans le menu Démarrer</li>
                                    <li>Cliquez sur "Modifier les variables d'environnement système"</li>
                                    <li>Cliquez sur "Variables d'environnement"</li>
                                    <li>Dans "Variables système", sélectionnez "Path" et cliquez sur "Modifier"</li>
                                    <li>Cliquez sur "Nouveau" et ajoutez le chemin vers le dossier bin (ex: <code>C:\\ffmpeg\\bin</code>)</li>
                                </ul>
                                <p>4. Redémarrez votre invite de commande pour appliquer les changements</p>
                            </div>
                            
                            <div class="os-content" id="macos-content" style="display: none;">
                                <p>1. Installez <a href="https://brew.sh/" target="_blank" style="color: #bf94ff;">Homebrew</a> si ce n'est pas déjà fait:</p>
                                <div style="background: #0e0e10; padding: 10px; border-radius: 4px; font-family: monospace; margin: 10px 0; white-space: nowrap; overflow-x: auto;">
                                    <code>/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"</code>
                                </div>
                                <p>2. Installez FFmpeg avec la commande:</p>
                                <div style="background: #0e0e10; padding: 10px; border-radius: 4px; font-family: monospace; margin: 10px 0;">
                                    <code>brew install ffmpeg</code>
                                </div>
                            </div>
                            
                            <div class="os-content" id="linux-content" style="display: none;">
                                <p>Pour Ubuntu/Debian:</p>
                                <div style="background: #0e0e10; padding: 10px; border-radius: 4px; font-family: monospace; margin: 10px 0;">
                                    <code>sudo apt update && sudo apt install ffmpeg</code>
                                </div>
                                <p>Pour Fedora:</p>
                                <div style="background: #0e0e10; padding: 10px; border-radius: 4px; font-family: monospace; margin: 10px 0;">
                                    <code>sudo dnf install ffmpeg</code>
                                </div>
                                <p>Pour Arch Linux:</p>
                                <div style="background: #0e0e10; padding: 10px; border-radius: 4px; font-family: monospace; margin: 10px 0;">
                                    <code>sudo pacman -S ffmpeg</code>
                                </div>
                            </div>
                        </div>
                        <div style="background: #0e0e10; padding: 10px; border-radius: 4px; font-family: monospace; margin: 10px 0; white-space: nowrap; overflow-x: auto;">
                            <code id="ffmpegCmd" style="color: #ddd;">ffmpeg -i ${safeFilename}.ts -c copy ${safeFilename}.mp4</code>
                        </div>
                        <button id="copyFfmpeg" style="background: #3a3a3d; border: none; color: white; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Copier la commande</button>
                    </div>
                </div>
            </div>
            <div style="margin-top: 20px; border-top: 1px solid #3a3a3d; padding-top: 15px; display: flex; justify-content: flex-end;">
                <button id="closeDialog" style="background: #18181b; border: 1px solid #3a3a3d; color: white; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Fermer</button>
            </div>
        `;

        document.body.appendChild(downloadDialog);


        const downloadButton = document.createElement('button');
        downloadButton.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
        `;
        downloadButton.className = 'ScCoreButton-sc-ocjdkq-0 ScCoreButtonSecondary-sc-ocjdkq-2';
        downloadButton.style.marginLeft = '10px';
        downloadButton.title = 'Télécharger VOD';


        downloadButton.addEventListener('click', async () => {
            const vodInfo = await getVodInfo(vodId);
            if (vodInfo.m3u8Url) {

                const safeFilename = createSafeFilename(vodInfo.title, vodId);


                downloadDialog.style.display = 'block';


                document.getElementById('directM3u8').addEventListener('click', async () => {
                    try {

                        const fixedContent = await getFixedM3u8Content(vodInfo.m3u8Url);
                        if (!fixedContent) {
                            alert('Erreur lors de la préparation du fichier. Veuillez réessayer.');
                            return;
                        }


                        const blob = new Blob([fixedContent], { type: 'application/x-mpegURL' });
                        const downloadUrl = URL.createObjectURL(blob);
                        const downloadLink = document.createElement('a');
                        downloadLink.href = downloadUrl;
                        downloadLink.setAttribute('download', `${safeFilename}.m3u8`);
                        downloadLink.click();


                        URL.revokeObjectURL(downloadUrl);


                        document.getElementById('nodeCmd').textContent = `node ts-downloader.js ${safeFilename}.m3u8`;
                        document.getElementById('ffmpegCmd').textContent = `ffmpeg -i ${safeFilename}.ts -c copy ${safeFilename}.mp4`;


                        document.getElementById('downloadHelp').style.display = 'block';
                    } catch (error) {
                        alert('Erreur: ' + error.message);
                    }
                });

                document.getElementById('copyNode').addEventListener('click', () => {
                    const cmd = document.getElementById('nodeCmd').textContent;
                    navigator.clipboard.writeText(cmd)
                        .then(() => {
                            const btn = document.getElementById('copyNode');
                            btn.textContent = 'Copié!';
                            setTimeout(() => { btn.textContent = 'Copier la commande'; }, 2000);
                        });
                });

                document.getElementById('copyFfmpeg').addEventListener('click', () => {
                    const cmd = document.getElementById('ffmpegCmd').textContent;
                    navigator.clipboard.writeText(cmd)
                        .then(() => {
                            const btn = document.getElementById('copyFfmpeg');
                            btn.textContent = 'Copié!';
                            setTimeout(() => { btn.textContent = 'Copier la commande'; }, 2000);
                        });
                });

                document.getElementById('downloadScript').addEventListener('click', (e) => {
                    e.preventDefault();


                    const scriptContent = `// ts-downloader.js - Outil pour télécharger les segments TS d'une VOD Twitch
// Utilisez: node ts-downloader.js <fichier-m3u8>

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
const lines = content.split('\\n');


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

console.log(\`Nombre total de segments: \${segments.length}\`);


function downloadSegment(url, outputPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(\`Erreur HTTP \${response.statusCode}\`));
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
    process.stdout.write(\`Progression: \${completed}/\${total} (\${percent}%)\`);
  };
  
  
  for (let i = 0; i < segments.length; i++) {
    const segmentUrl = segments[i];
    const segmentPath = path.join(outputDir, \`segment_\${i}.ts\`);
    
    try {
      
      await downloadSegment(segmentUrl, segmentPath);
      
      
      const segmentData = fs.readFileSync(segmentPath);
      combinedFile.write(segmentData);
      
      
      fs.unlinkSync(segmentPath);
      
      
      completed++;
      updateProgress();
      
    } catch (error) {
      console.error(\`\\nErreur lors du téléchargement du segment \${i}:\`, error.message);
      
    }
  }
  
  combinedFile.end();
  console.log(\`\\nTéléchargement terminé. Fichier enregistré: \${outputFile}\`);
  console.log(\`\\nPour convertir en MP4, utilisez cette commande: ffmpeg -i \${outputFile} -c copy \${outputFile.replace('.ts', '.mp4')}\`);
}


downloadAllSegments().catch(err => {
  console.error('\\nErreur:', err);
});`;


                    const blob = new Blob([scriptContent], { type: 'application/javascript' });
                    const url = URL.createObjectURL(blob);
                    const downloadLink = document.createElement('a');
                    downloadLink.href = url;
                    downloadLink.setAttribute('download', 'ts-downloader.js');
                    downloadLink.click();
                    URL.revokeObjectURL(url);
                });

                document.getElementById('closeDialog').addEventListener('click', () => {
                    downloadDialog.style.display = 'none';
                });


                document.getElementById('ffmpegHelp').addEventListener('click', () => {
                    const guide = document.getElementById('ffmpegInstallGuide');
                    guide.style.display = guide.style.display === 'none' ? 'block' : 'none';
                });


                document.querySelectorAll('.os-tab').forEach(tab => {
                    tab.addEventListener('click', () => {

                        document.querySelectorAll('.os-content').forEach(content => {
                            content.style.display = 'none';
                        });


                        document.querySelectorAll('.os-tab').forEach(t => {
                            t.classList.remove('active');
                            t.style.borderBottom = '2px solid transparent';
                        });


                        const os = tab.getAttribute('data-os');
                        document.getElementById(`${os}-content`).style.display = 'block';


                        tab.classList.add('active');
                        tab.style.borderBottom = '2px solid #9147ff';
                    });
                });
            } else {
                alert('Impossible d\'obtenir l\'URL vidéo. Veuillez réessayer quand la vidéo est en cours de lecture.');
            }
        });


        controlsContainer.appendChild(downloadButton);
        downloadButtonAdded = true;


        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const dialog = document.querySelector('div[style*="fixed"]');
                if (dialog && dialog.style.display !== 'none') {
                    dialog.style.display = 'none';
                }
            }
        });

        console.log('TwitchNoSub: Download button added');
    }


    function checkAndAddButton() {
        const isVodPage = window.location.pathname.includes('/videos/');
        if (isVodPage) {
            createDownloadButton();
        } else {
            downloadButtonAdded = false;
        }
    }


    checkAndAddButton();


    const pushState = history.pushState;
    history.pushState = function() {
        pushState.apply(history, arguments);
        setTimeout(checkAndAddButton, 1000);
    };


    window.addEventListener('popstate', () => {
        setTimeout(checkAndAddButton, 1000);
    });


    setInterval(checkAndAddButton, 3000);
})();