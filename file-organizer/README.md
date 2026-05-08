# File Organizer CLI

CLI-застосунок на Node.js для аналізу, очищення та організації файлів.

---

## Встановлення

```bash
git clone <your-repo-link>
cd file-organizer
npm install
```

---

## Запуск

Усі команди виконуються через:

```bash
node file-organizer.js <command> <directory>
```

---

## Команди

### scan — аналіз директорії

```bash
node file-organizer.js scan /path/to/directory
```

Показує:
- кількість файлів
- загальний розмір
- групування по типах
- розподіл за віком
- топ-3 найбільших файлів
- найстаріший файл

---

### duplicates — пошук дублікатів

```bash
node file-organizer.js duplicates /path/to/directory
```

Показує:
- файли з однаковим SHA-256 хешем
- групи дублікатів
- зайнятий зайвий простір

---

### organize — сортування файлів

```bash
node file-organizer.js organize /source --output /target
```

Файли копіюються у категорії:
- Documents
- Images
- Archives
- Code
- Videos
- Other

Підтримує:
- великі файли через streams
- уникнення конфліктів імен

---

### cleanup — очищення старих файлів

Dry run (без видалення):

```bash
node file-organizer.js cleanup /path --older-than 90
```

Реальне видалення:

```bash
node file-organizer.js cleanup /path --older-than 90 --confirm
```

---

## Технології

- Node.js (ES Modules)
- fs / fs/promises
- streams (pipeline)
- crypto (SHA-256)
- EventEmitter

---

## Архітектура

Кожна команда реалізована як окремий клас:

```
lib/
  scanner.js
  duplicates.js
  organizer.js
  cleanup.js
```

Використовується EventEmitter для:
- прогресу
- оновлення статусу
- відділення логіки від UI

---

## Обробка помилок

Підтримуються:
- ENOENT — файл/директорія не існує
- EACCES — немає прав доступу
- інші помилки

---

## Приклад

```bash
node file-organizer.js scan .
```

```
Scanning: .
Processing... 10/10 files

Scan Results:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total files: 10
Total size: 2.3 MB
```

---

## Статус

- scan
- duplicates
- organize
- cleanup 
