# Sales Web Dashboard

Окремий веб-дашборд для порівняння менеджерів Вова / Бек.

## Що показує

- дзвінки загалом
- дзвінки більше 1 хв
- продажі факт
- конверсія = продажі факт / дзвінки
- фільтр по менеджеру
- фільтр по даті від / до
- групування по днях, тижнях, місяцях
- графік динаміки
- графік порівняння менеджерів
- детальна таблиця

## Структура файлів

```text
index.html
style.css
app.js
README.md
```

## Важливо для Google Sheets

Google таблиці мають бути доступні для перегляду за посиланням.

Тобто:
```text
Share → General access → Anyone with the link → Viewer
```

Якщо таблиця приватна, сайт на GitHub Pages не зможе її прочитати напряму.

## Як додати новий місяць

Якщо у Google Sheets з'явиться новий лист, наприклад `072026`, відкрий `app.js` і додай його в `sheetTabs`.

Було:

```js
sheetTabs: ["062026"]
```

Стане:

```js
sheetTabs: ["062026", "072026"]
```

Так треба зробити для кожного менеджера.

## Як змінити колонки

У `app.js` є блок:

```js
columns: {
  date: 0,
  calls: 3,
  callsLong: 4,
  messagesNoCall: 5,
  newCrm: 6,
  nonTarget: 7,
  salesPlan: 8,
  salesAgreed: 9,
  salesFact: 22
}
```

A = 0, B = 1, C = 2, D = 3 і так далі.

## Як залити на GitHub Pages

1. Створи новий репозиторій на GitHub.
2. Завантаж туди `index.html`, `style.css`, `app.js`.
3. Відкрий:
   ```text
   Settings → Pages
   ```
4. У Source вибери:
   ```text
   Deploy from a branch
   ```
5. Branch:
   ```text
   main / root
   ```
6. Збережи.
7. GitHub дасть посилання на сайт.
