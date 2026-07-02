const fs = require('fs');
const path = require('path');

const characters = [
  'Homer_Simpson',
  'Marge_Simpson',
  'Bart_Simpson',
  'Lisa_Simpson',
  'Maggie_Simpson',
  'Mr._Burns',
  'Ned_Flanders',
  'Moe_Szyslak',
  'Milhouse_Van_Houten',
  'Nelson_Muntz',
  'Ralph_Wiggum',
  'Chief_Wiggum',
  'Krusty_the_Clown',
  'Waylon_Smithers',
  'Apu_Nahasapeemapetilon'
];

const dir = path.join(__dirname, 'public', 'avatars', 'simpsons');

async function download() {
  for (const name of characters) {
    try {
      const api = `https://en.wikipedia.org/w/api.php?action=query&titles=${name}&prop=pageimages&format=json&pithumbsize=500`;
      const res = await fetch(api);
      const json = await res.json();
      const pages = json.query.pages;
      const pageId = Object.keys(pages)[0];
      const thumb = pages[pageId].thumbnail;
      if (!thumb) {
        console.log(`No image for ${name}`);
        continue;
      }
      
      const imageUrl = thumb.source;
      const dest = path.join(dir, `${name.split('_')[0].toLowerCase()}.png`);
      
      const imgRes = await fetch(imageUrl);
      const arrayBuffer = await imgRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(dest, buffer);
      console.log(`Downloaded ${name} to ${dest}`);
    } catch (e) {
      console.error(e);
    }
  }
}

download().then(() => console.log('Done!')).catch(console.error);
