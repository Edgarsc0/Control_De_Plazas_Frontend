#!/bin/bash
set -e

# Create target directories
mkdir -p ../../../public/videos

echo "Iniciando renderizado de videos de características con HyperFrames..."

echo "1. Renderizando plazas..."
cd plazas && npx --yes hyperframes@0.4.42 render --workers 1 --output ../../../../public/videos/plazas.mp4
cd ..

echo "2. Renderizando presupuesto..."
cd presupuesto && npx --yes hyperframes@0.4.42 render --workers 1 --output ../../../../public/videos/presupuesto.mp4
cd ..

echo "3. Renderizando plantilla..."
cd plantilla && npx --yes hyperframes@0.4.42 render --workers 1 --output ../../../../public/videos/plantilla.mp4
cd ..

echo "4. Renderizando movimientos..."
cd movimientos && npx --yes hyperframes@0.4.42 render --workers 1 --output ../../../../public/videos/movimientos.mp4
cd ..

echo "5. Renderizando organigrama..."
cd organigrama && npx --yes hyperframes@0.4.42 render --workers 1 --output ../../../../public/videos/organigrama.mp4
cd ..

echo "6. Renderizando zafiro..."
cd zafiro && npx --yes hyperframes@0.4.42 render --workers 1 --output ../../../../public/videos/zafiro.mp4
cd ..

echo "7. Renderizando infraestructura..."
cd infraestructura && npx --yes hyperframes@0.4.42 render --workers 1 --output ../../../../public/videos/infraestructura.mp4
cd ..

echo "¡Renderizado completo con éxito! Todos los videos guardados en public/videos/."
