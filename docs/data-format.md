# 台南市不動產實價登錄資料格式

資料來源：`plvr.land.moi.gov.tw`（內政部不動產交易實價查詢服務網）  
下載 URL：`https://plvr.land.moi.gov.tw/DownloadSeason?season={季別}&fileName={檔名}`  
季別格式：`114S3` = 民國114年第3季（7–9月）

---

## 成屋買賣（`d_lvr_land_a.csv`）　共 33 欄

| # | CSV 欄位名 | 資料庫欄位 | 說明 |
|---|---|---|---|
| 1 | 鄉鎮市區 | `district` | 行政區 |
| 2 | 交易標的 | `transaction_target` | 土地/建物/車位組合 |
| 3 | 土地位置建物門牌 | `address` | 完整門牌 |
| 4 | 土地移轉總面積平方公尺 | `land_area_sqm` | 單位 m² |
| 5 | 都市土地使用分區 | `urban_land_use` | 住宅區/商業區… |
| 6 | 非都市土地使用分區 | `non_urban_land_use` | 一般農業區… |
| 7 | 非都市土地使用編定 | — | 未入庫 |
| 8 | 交易年月日 | `transaction_date` | 民國轉 ISO（1140301→2025-03-01） |
| 9 | 交易筆棟數 | `transaction_pen_count` | 如「土地1筆建物1棟車位1個」 |
| 10 | 移轉層次 | `floor` | 如「三層」 |
| 11 | 總樓層數 | `total_floors` | 棟的總層數 |
| 12 | 建物型態 | `building_type` | 住宅大樓/透天厝/華廈… |
| 13 | 主要用途 | `main_use` | 住家用/商業用… |
| 14 | 主要建材 | `main_material` | 鋼筋混凝土造… |
| 15 | 建築完成年月 | `completion_date` | 民國年月，如「11210」 |
| 16 | 建物移轉總面積平方公尺 | `building_area_sqm` | 含公設總面積，m² |
| 17 | 建物現況格局-房 | `rooms` | 房間數 |
| 18 | 建物現況格局-廳 | `living_rooms` | 廳數 |
| 19 | 建物現況格局-衛 | `bathrooms` | 衛浴數 |
| 20 | 建物現況格局-隔間 | — | 未入庫 |
| 21 | 有無管理組織 | `has_management` | boolean |
| 22 | 總價元 | `total_price` | 含車位，單位元 |
| 23 | 單價元平方公尺 | `unit_price_sqm` | 元/m² |
| 24 | 車位類別 | `parking_type` | 坡道平面/塔式機械… |
| 25 | 車位移轉總面積平方公尺 | `parking_area_sqm` | m² |
| 26 | 車位總價元 | `parking_price` | 元 |
| 27 | 備註 | `notes` | 備註 |
| 28 | 編號 | `serial_number` | 主鍵之一 |
| **29** | **主建物面積** | `main_building_area_sqm` | **成屋獨有**，主建物 m² |
| **30** | **附屬建物面積** | `auxiliary_building_area` | **成屋獨有**，儲藏室等 m² |
| **31** | **陽台面積** | `balcony_area_sqm` | **成屋獨有**，陽台 m² |
| **32** | **電梯** | `has_elevator` | **成屋獨有**，boolean |
| 33 | 移轉編號 | `serial_number`（備用） | 部分季別用此欄取代「編號」 |

> **公設比計算（成屋專用）：**
> ```
> 公設比 = (建物面積 − 主建物面積 − 附屬建物面積 − 陽台面積) / 建物面積 × 100%
> ```

---

## 預售屋買賣（`d_lvr_land_b.csv`）　共 31 欄　（從 110S2 開始）

| # | CSV 欄位名 | 資料庫欄位 | 說明 |
|---|---|---|---|
| 1 | 鄉鎮市區 | `district` | 行政區 |
| 2 | 交易標的 | `transaction_target` | 土地/建物/車位組合 |
| 3 | 土地位置建物門牌 | `address` | 完整門牌 |
| 4 | 土地移轉總面積平方公尺 | `land_area_sqm` | 單位 m² |
| 5 | 都市土地使用分區 | `urban_land_use` | 住宅區/商業區… |
| 6 | 非都市土地使用分區 | `non_urban_land_use` | 一般農業區… |
| 7 | 非都市土地使用編定 | — | 未入庫 |
| 8 | 交易年月日 | `transaction_date` | 民國轉 ISO |
| 9 | 交易筆棟數 | `transaction_pen_count` | |
| 10 | 移轉層次 | `floor` | |
| 11 | 總樓層數 | `total_floors` | |
| 12 | 建物型態 | `building_type` | |
| 13 | 主要用途 | `main_use` | |
| 14 | 主要建材 | `main_material` | |
| 15 | 建築完成年月 | `completion_date` | |
| 16 | 建物移轉總面積平方公尺 | `building_area_sqm` | 合約登記面積，m² |
| 17 | 建物現況格局-房 | `rooms` | |
| 18 | 建物現況格局-廳 | `living_rooms` | |
| 19 | 建物現況格局-衛 | `bathrooms` | |
| 20 | 建物現況格局-隔間 | — | 未入庫 |
| 21 | 有無管理組織 | `has_management` | |
| 22 | 總價元 | `total_price` | |
| 23 | 單價元平方公尺 | `unit_price_sqm` | |
| 24 | 車位類別 | `parking_type` | |
| 25 | 車位移轉總面積平方公尺 | `parking_area_sqm` | |
| 26 | 車位總價元 | `parking_price` | |
| 27 | 備註 | `notes` | |
| 28 | 編號 | `serial_number` | |
| **29** | **建案名稱** | `project_name` | **預售獨有**，如「府居柏金」 |
| **30** | **棟及號** | — | **預售獨有**，如「A棟6號」，未入庫 |
| **31** | **解約情形** | — | **預售獨有**，有值的記錄在匯入時排除 |

> **預售屋沒有的欄位（→ 公設比無法計算）：**
> 主建物面積、附屬建物面積、陽台面積、電梯

---

## 差異對照

| 項目 | 成屋（a 檔） | 預售屋（b 檔） |
|---|---|---|
| 欄位數 | 33 | 31 |
| 開始收錄 | 101S1（2012年） | 110S2（2021年） |
| 主建物面積 | ✅ | ❌ |
| 附屬建物面積 | ✅ | ❌ |
| 陽台面積 | ✅ | ❌ |
| 電梯 | ✅ | ❌ |
| 公設比可計算 | ✅ | ❌ |
| 建案名稱 | ❌ | ✅ |
| 棟及號 | ❌ | ✅ |
| 解約情形 | ❌ | ✅（有解約者排除） |
