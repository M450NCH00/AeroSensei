// generate-scores.cjs
const fs = require('fs');
const path = require('path');

const geojsonPath = path.join(__dirname, 'public', 'gadmVNM.json');
const outputPath = path.join(__dirname, 'public', 'industrialData.json');

// Helper to remove accents AND all spaces/special characters
const normalize = (str) => {
  if (!str) return "";
  return str.normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/Đ/g, "D")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, ""); // Strips spaces, hyphens, etc.
};

// Categorized Provinces (No spaces, no hyphens)
const tier1Industrial = ["binhduong", "dongnai", "hochiminh", "hanoi", "bacninh", "haiphong", "quangninh", "bariavungtau", "bacgiang"];
const tier2Moderate = ["danang", "longan", "vinhphuc", "thainguyen", "haiduong", "hungyen", "hanam", "tayninh", "cantho", "thanhhoa", "hatinh", "quangnam", "quangngai"];
const tier3Clean = ["hagiang", "caobang", "backan", "tuyenquang", "laocai", "dienbien", "laichau", "sonla", "hoabinh", "kontum", "gialai", "daklak", "daknong", "lamdong", "yenbai", "langson"];

// Specific District Overrides (Extreme Highs / Lows)
const extremeIndustrial = ["thuanan", "dian", "bienhoa", "thuduc", "caugiay", "hoangmai", "thuynguyen", "bencat", "tuson", "yenphong", "nhontrach", "phumy", "binhchanh", "binhtan", "vinhyen"];
const extremeClean = ["phuquoc", "condao", "sapa", "dalat", "bavi", "mocchau", "hoangsuphi", "meovac", "coto", "lyson", "tamdao", "mucangchai"];

try {
  const rawData = fs.readFileSync(geojsonPath, 'utf8');
  const geojson = JSON.parse(rawData);
  const industrialScores = {};

  geojson.features.forEach((feature) => {
    // Check both NAME_1 (Province) and NAME_2 (District)
    const rawProvince = feature.properties?.NAME_1;
    const rawDistrict = feature.properties?.NAME_2 || feature.properties?.name_2;
    
    if (!rawDistrict) return;

    const prov = normalize(rawProvince);
    const dist = normalize(rawDistrict);

    let baseScore = 35; // Default agricultural / coastal baseline

    // 1. Apply Province-level baseline
    if (tier1Industrial.includes(prov)) baseScore = 78;
    else if (tier2Moderate.includes(prov)) baseScore = 55;
    else if (tier3Clean.includes(prov)) baseScore = 15;

    // 2. Apply Hard Overrides for specific locations
    if (extremeIndustrial.some(ind => dist.includes(ind))) baseScore = 92;
    if (extremeClean.some(clean => dist.includes(clean))) baseScore = 10;

    // 3. Add organic "jitter" (-7 to +7)
    const jitter = Math.floor(Math.random() * 15) - 7;
    let finalScore = baseScore + jitter;

    // Clamp the score between 0 and 100
    finalScore = Math.max(0, Math.min(100, finalScore));

    // Save using the original exact name from the JSON
    industrialScores[rawDistrict] = finalScore;
  });

  fs.writeFileSync(outputPath, JSON.stringify(industrialScores, null, 2), 'utf8');
  console.log(`Successfully generated believable data for ${Object.keys(industrialScores).length} districts!`);
} catch (error) {
  console.error("Error generating data. Ensure public/gadmVNM.json exists.", error);
}