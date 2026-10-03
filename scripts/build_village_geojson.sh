#!/usr/bin/env bash
# ============================================================
# 台南村里界線 → public/geo/tainan_villages.json（潛在客群頁地圖用）
# 來源：內政部國土測繪中心「村(里)界(TWD97經緯度)」（data.gov.tw 7438）
#   https://www.tgos.tw/tgos/VirtualDir/Product/a04697c8-64db-450a-a105-3eb471c45abd/村(里)界(TWD97經緯度).zip
# 用法（專案根目錄）：bash scripts/build_village_geojson.sh <解壓後的 VILLAGE_NLSC_*.shp>
# 需求：npx（臨時下載 mapshaper，不寫入 package.json）
# VILLCODE 與戶政 district_code（villages.village_code）同為 11 碼，可直接對應
# ============================================================
set -euo pipefail
SHP="${1:?請指定 VILLAGE_NLSC_*.shp 路徑}"
TMP="$(mktemp -d)"

# 只留臺南市；簡化間距 10 公尺（保留拓樸、不讓小里消失）；座標精度 1e-5 度（約 1 公尺）
npx -y mapshaper@0.6 "$SHP" encoding=utf8 \
  -filter 'COUNTYNAME=="臺南市"' \
  -rename-fields code=VILLCODE \
  -filter-fields code \
  -simplify interval=10 keep-shapes \
  -clean \
  -o "$TMP/out.json" format=geojson precision=0.00001

mkdir -p public/geo
# 壓成單行，減少檔案大小
python3 -c "import json,sys; json.dump(json.load(open(sys.argv[1])), open(sys.argv[2],'w'), separators=(',',':'))" \
  "$TMP/out.json" public/geo/tainan_villages.json
rm -rf "$TMP"
echo "已輸出 public/geo/tainan_villages.json"
