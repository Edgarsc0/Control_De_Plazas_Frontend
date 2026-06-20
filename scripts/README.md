# scripts/

Scripts Python autogenerados (codemods/parches puntuales) usados durante el
desarrollo del frontend. **No son parte del runtime** — ningún archivo JS/JSX los
importa. Aislados aquí para no mezclarlos con el código fuente.

## patches/
Codemods que editaban archivos del fuente (un solo uso):
`add_search.py`, `fix_layout.py`, `fix_movimientos.py`, `fix_service.py`,
`fix_tabs.py`, `fix_actuales.py`, `make_map_fullscreen.py`,
`make_mapatab_fullscreen.py`, `make_text_darker.py`, `make_text_darker_main.py`,
`patch_movimientos.py`, `replace_theme.py`, `replace_theme_modal.py`.

## scratch/
Recuperación, reversión y generación puntual:
`refactor.py`, `recover_file.py`, `recover_stats.py`, `restore_filters.py`,
`restore_stats.py`, `revert_tabs.py`, `gen_bajas.py`.

## extract/
Extracción de datos/markup:
`extract_full.py`, `extract_pie.py`, `table_extract.py`.

> Conservados versionados por historial. Si se confirman desechables, candidatos a
> borrado en una limpieza posterior.
