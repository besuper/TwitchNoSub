
self.onmessage = async function(e) {
  const { m3u8Url, vodId } = e.data;
  
  try {

    const m3u8Response = await fetch(m3u8Url);
    if (!m3u8Response.ok) {
      throw new Error(`Erreur lors du téléchargement du fichier m3u8: ${m3u8Response.status}`);
    }
    
    const m3u8Content = await m3u8Response.text();
    

    const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
    

    const segmentUrls = [];
    const lines = m3u8Content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].endsWith('.ts')) {
        segmentUrls.push(baseUrl + lines[i]);
      }
    }
    
    if (segmentUrls.length === 0) {


      let subPlaylistUrl = '';
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].endsWith('.m3u8')) {
          subPlaylistUrl = baseUrl + lines[i];
          break;
        }
      }
      
      if (subPlaylistUrl) {

        const subResponse = await fetch(subPlaylistUrl);
        if (!subResponse.ok) {
          throw new Error(`Erreur lors du téléchargement de la sous-playlist: ${subResponse.status}`);
        }
        
        const subContent = await subResponse.text();
        const subBaseUrl = subPlaylistUrl.substring(0, subPlaylistUrl.lastIndexOf('/') + 1);
        

        const subLines = subContent.split('\n');
        for (let i = 0; i < subLines.length; i++) {
          if (subLines[i].endsWith('.ts')) {
            segmentUrls.push(subBaseUrl + subLines[i]);
          }
        }
      }
    }
    
    self.postMessage({ 
      type: 'info', 
      message: `Téléchargement de ${segmentUrls.length} segments...` 
    });
    

    let completedSegments = 0;
    const totalSegments = segmentUrls.length;
    const chunkSize = 20;
    

    const segments = new Map();
    

    for (let i = 0; i < totalSegments; i += chunkSize) {
      const batch = segmentUrls.slice(i, i + chunkSize);
      
      await Promise.all(batch.map(async (url, index) => {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to download segment: ${response.status}`);
          }
          
          const buffer = await response.arrayBuffer();
          segments.set(i + index, new Uint8Array(buffer));
          
          completedSegments++;
          if (completedSegments % 10 === 0 || completedSegments === totalSegments) {
            self.postMessage({ 
              type: 'progress', 
              completed: completedSegments, 
              total: totalSegments 
            });
          }
        } catch (error) {
          self.postMessage({ 
            type: 'error', 
            message: `Erreur segment ${i + index}: ${error.message}` 
          });
        }
      }));
    }
    

    self.postMessage({ type: 'info', message: 'Combinaison des segments...' });
    

    let totalSize = 0;
    for (const segment of segments.values()) {
      totalSize += segment.length;
    }
    

    const combined = new Uint8Array(totalSize);
    let offset = 0;
    

    const sortedSegments = Array.from(segments.entries()).sort((a, b) => a[0] - b[0]);
    

    for (const [_, segment] of sortedSegments) {
      combined.set(segment, offset);
      offset += segment.length;
    }
    
    self.postMessage({ 
      type: 'complete', 
      data: combined.buffer,
      filename: `twitch_vod_${vodId}.ts` 
    }, [combined.buffer]);
    
  } catch (error) {
    self.postMessage({ 
      type: 'error', 
      message: `Erreur: ${error.message}` 
    });
  }
};
