# Sun King — Data Reconciliation Report

_Generated 2026-06-03. Inputs: Master Tracker xlsx "(10)", Google export 20260603-101343, prior app seed._

- Reconciled tracker rows written: **488**
- Source: Master Tracker sheet (human truth) + Google export (account truth)
- Business names standardized to **Google public name**: **65**
- Duplicate groups flagged (NOT merged, placed adjacent): **11**

## Duplicate groups (flagged, not merged)

| # | Group | Reason | Codes (canonical first) | Note |
|---|-------|--------|--------------------------|------|
| 1 | Zambia Head Office | Same Google code entered twice in tracker | `12610017379071464310` ✅canon + `12610017379071464310` ✅canon |  |
| 2 | Owerri | Leading-zero code variant; Google flags the stripped form as Duplicate | `08294824709221259563` ✅canon + `8294824709221259563` ⚠dup |  |
| 3 | Samfya | Leading-zero code variant; Google flags the stripped form as Duplicate | `06418181730203418502` ✅canon + `6418181730203418502` ⚠dup |  |
| 4 | Store Ido | Two distinct Google codes for the same shop name+country | `18212165243972247082` ✅canon + `08437939975684042191` ⚠dup |  |
| 5 | Garden House | Two distinct Google codes for the same shop name+country | `09767504174260510475` ✅canon + `5794376111423397473` ⚠dup |  |
| 6 | Bangwe | Google flags a second listing as Duplicate | `12422060149163512049` ⚠dup | ⚠ canonical sibling not found in data — review |
| 7 | Eldoret | Google flags a second listing as Duplicate | `SKKEEC143` ✅canon + `13441008733208717214` ⚠dup |  |
| 8 | Luwero | Google flags a second listing as Duplicate | `05638313038998589285` ⚠dup | ⚠ canonical sibling not found in data — review |
| 9 | Nigeria Corporate Office | Google has a Duplicate listing (code corrupted to scientific notation in export) | `10446200711127298340` ✅canon |  |
| 10 | Abeokuta | Google has a Duplicate listing (code corrupted to scientific notation in export) | `10688375190153225989` ✅canon |  |
| 11 | Alakia | Second Google listing (Not published) duplicates the published one | `04661794823888764123` ✅canon + `13056647606553639934` ⚠dup |  |

## ⚠ Name changes that alter the LOCALITY — review these

Per your decision, Google's public name was applied everywhere. These few, however, swap the town/locality token entirely — verify they are the same physical location, or revert the name.

| Store code | Was (sheet) | Now (Google) |
|------------|-------------|--------------|
| `09040051769838290953` | Sun King Shop Kamwala | **Sun King Lusaka CBD Store** |
| `16435150637072034214` | Sun King Shop Kinangop | **Sun King Shop Engineer** |
| `2610491541686697679` | Sun King Shop Kpalime | **Sun King Shop Kpalimé** |
| `11775538172012798631` | Sun King Shop Lome | **Sun King Shop Lomé** |
| `17875387949633657660` | Sun King Shop Mlolongo | **Sunking Shop Kitengela** |
| `07391914500854160840` | Sun King Shop Ol Kalou | **Sun King Shop Nyandarua** |
| `02196973378313250199` | Sun King Store Hadeija | **Sun King Store Hadejia** |
| `05532348912128107634` | Sun King Store Ogbomoso | **Sun King Store Ogbomosho** |

## Business-name standardizations (sheet → Google public name)

| Store code | Was (sheet) | Now (Google) |
|------------|-------------|--------------|
| `16274451082254526603` | Sun King LPG Depot Bungoma | Sun King Shop LPG Bungoma |
| `04657757721143839652` | Sun King LPG Depot Kakamega | Sun King Shop LPG Kakamega |
| `09860249376389197460` | Sun King LPG Depot Kayole | Sun King Shop LPG Kayole |
| `10446200711127298340` | Sun King Nigera Head Office / Sun King Nigeria Corporate Office | Sun King Nigeria Corporate Office |
| `10654598285006699670` | Sun King Shop Bagamoyo | Sun King Store Bagamoyo |
| `12422060149163512049` | Sun King Shop Bangwe | Sun King Store Bangwe |
| `04083552864584210478` | Sun King Shop Bohicon | Sun King Store Bohicon |
| `10776646731838839014` | Sun King Shop Busia | Sun King Store Busia |
| `11632807300180575548` | Sun King Shop Chibombo | Sun King Store Chibombo |
| `00837250053016057111` | Sun King Shop Chililabombwe | Sun King Store Chililabombwe |
| `15061145144237651587` | Sun King Shop Chipata | Sun King Chipata Shop |
| `14310226206725501377` | Sun King Shop Chongwe | Sun King Store Chongwe |
| `08687311506536048251` | Sun King Shop Ganze | Sun King Store Ganze |
| `12983684220069798081` | Sun King Shop Guerin Kouka | Sun King Shop Guerin-Kouka |
| `11097134017912115358` | Sun King Shop Handeni | SunKing Handeni Store |
| `04176478005186292162` | Sun King Shop Isiolo | Sun King Store Isiolo |
| `01260136827894845638` | Sun King Shop Kalulushi | Sun King Store Kalulushi |
| `09040051769838290953` | Sun King Shop Kamwala | Sun King Lusaka CBD Store |
| `06202710912043773961` | Sun King Shop Kapchorwa | Sun King Store Kapchorwa |
| `07124115810606733129` | Sun King Shop Kara | Sun King Store Kara |
| `02411958068680764405` | Sun King Shop Kasempa | Sun King Kasempa Shop |
| `11287337267941278360` | Sun King Shop Katete | Sun King Store Katete |
| `03546201151900033800` | Sun King Shop Katuba | Sun King Store Katuba |
| `16435150637072034214` | Sun King Shop Kinangop | Sun King Shop Engineer |
| `07792265113715852457` | Sun King Shop Kitwe | Sun King Store Kitwe Shop |
| `2610491541686697679` | Sun King Shop Kpalime | Sun King Shop Kpalimé |
| `11775538172012798631` | Sun King Shop Lome | Sun King Shop Lomé |
| `04791868452572969398` | Sun King Shop Mansa | Sun King Store Mansa |
| `11900563337142464418` | Sun King Shop Mau Narok | Sun King Store Mau Narok |
| `15156235998468950398` | Sun King Shop Maua | Sun King Store Maua |
| `08758588333461315862` | Sun King Shop Mbita | Sun King Store Mbita |
| `14327922196602889989` | Sun King Shop Mitundu | Sun King Store Mitundu |
| `11738688433753438507` | Sun King Shop Mkuranga | Sun King Store Mkuranga |
| `00606765878322947726` | Sun King Shop Mkushi | Sun King Store Mkushi |
| `17875387949633657660` | Sun King Shop Mlolongo | Sunking Shop Kitengela |
| `00827272395238404839` | Sun King Shop Mpika | Sun King Store Mpika |
| `13229866745640633752` | Sun King Shop Mponela | Sun King Store Mponela |
| `08214129426015750045` | Sun King Shop Mufulira | Sun King Mufulira |
| `00320005974292304224` | Sun King Shop Mumbwa | Sun King, Mumbwa |
| `03797602332413270851` | Sun King Shop Murang'a | sunking store murang'a |
| `16867725007606170051` | Sun King Shop Mwinilunga | Sun King Store Mwinilunga |
| `13019924970230947480` | Sun King Shop Nansana | Sun King Nansana Store |
| `07391914500854160840` | Sun King Shop Ol Kalou | Sun King Shop Nyandarua |
| `16734917307464038773` | Sun King Shop Petauke | Sun King Store Petauke |
| `01689902433027335913` | Sun King Shop Singida | Sun King Store Singida |
| `13123251272698496043` | Sun King Shop Songwe | Sun King Store Songwe |
| `07822554077025578350` | Sun King Shop Unguja | Sun King Unguja Shop |
| `17472554167137563030` | Sun King Store Akure North | Sun King Store Akure- North |
| `13672610567390145416` | Sun King Store Alagbole Akute | Sunking Store Alagbole-Akute |
| `04661794823888764123` | Sun King Store Alakia | Sun King Shop Alakia |
| `14171552394895214709` | Sun King Store Asaba | Sun King Shop Asaba |
| `10804625262178599058` | Sun King Store Eket | SUN KING-EKET STORE |
| `06277958077790920495` | Sun King Store Eleme | Sun King Shop Eleme |
| `03727938655851353528` | Sun King Store Epe | Sun King Shop Epe |
| `04495659965574347812` | Sun King Store Gwagwalada | Sun King Shop Gwagwalada |
| `02196973378313250199` | Sun King Store Hadeija | Sun King Store Hadejia |
| `06926227185654039578` | Sun King Store Ikole Ekiti | Sun King Store Ikole-Ekiti |
| `08329907594882922584` | Sun King Store Ikorodu East | Sun King Shop Ikorodu East |
| `08484839975515902156` | Sun King Store Ilaro | Sun King Shop Ilaro |
| `17609045350449949600` | Sun King Store Ilorin North | Sun King Shop Ilorin-North |
| `13426671352071166027` | Sun King Store Offa | Sun King Offa |
| `05532348912128107634` | Sun King Store Ogbomoso | Sun King Store Ogbomosho |
| `08552001041521847848` | Sun King Warehouse and Assembly Hub | Sun King Warehouse & Assembly Hub |
| `16373124300768340851` | Sun King Warehouse Kakamega | Sun King Warehouse |
| `12610017379071464310` | Sun King Zambia Head Office | Sun King Head Office, Lusaka, Zambia. |
