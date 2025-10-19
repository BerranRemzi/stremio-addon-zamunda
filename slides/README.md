# OpenFest 2025 Lightning Talk — Slides

- Файл със слайдове (Marp): `slides/openfest-2025-lightning-talk.md`

## Бърз преглед на място

1) Инсталирай Marp CLI:
```bash
npm i -g @marp-team/marp-cli
```
2) Стартирай локален преглед с автоматично презареждане:
```bash
marp -s slides/
```
3) Отвори в браузър адреса, който Marp показва.

## Експорт

- Експорт в PDF:
```bash
marp slides/openfest-2025-lightning-talk.md --pdf --allow-local-files -o slides/openfest-2025-lightning-talk.pdf
```
- Експорт в HTML (единичен файл):
```bash
marp slides/openfest-2025-lightning-talk.md --html --allow-local-files -o slides/openfest-2025-lightning-talk.html
```

## Презентация

- Пълен екран в браузър (HTML export) → натисни `F` за fullscreen.
- Навигация: стрелки ← → или Space.
- Бележки за говорещия са в HTML devtools или ползвай Marp Presenter View:
```bash
marp -s slides/ --preview --allow-local-files
```

Ако не искаш да инсталираш нищо локално, може да отвориш `openfest-2025-lightning-talk.md` в VS Code + разширение Marp for VS Code и да презентираш директно оттам.