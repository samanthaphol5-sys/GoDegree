## set up MySQL รันตามนี้นะจ๊ะ
Godegree_table.sql -> procedure.sql -> trigger.sql -> insert_sample.sql -> insert_demo.sql 

## web app
npm install 
npm run dev; ไม่ได้แก้อะไรรัน npm start ก็ได้
create .env (ตาม .env.example แก้ข้อมูลให้ตรงกับเครื่องที่รันด้วยนะ)

## How to test (request.http)
1. install extension 'REST Client'
2. send request ที่ T10-T12 ก่อน เพราะต้องใช้ tokenจากสามตัวนี้
3. ไล่ T01-T53 ไปเลยมี 'Should be' comment ไว้ดูให้มันออกตรงกัน ถ้าเขียนงงก็ขอโทษด้วยครับ

## ถ้ารันไปแล้วรอบนึง แล้วจะแก้ดูใหม่อย่าลืม rebuild DB ตามเดิมก่อนรันนะ
