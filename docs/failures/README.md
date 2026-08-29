# Memoria de regresiones

Este directorio conserva incidentes que deben convertirse en controles permanentes. No reemplaza `bugs-knowhow.md`: ese archivo sigue siendo la memoria historica amplia; aqui se registran incidentes estructurados, vinculados a un flujo `R#` y a una prueba que detecta su retorno.

Crear una nota:

```powershell
npm run qa:incident -- --id INC-2026-001 --flow R2 --summary "Perdida de mutaciones offline"
```

El comando no acepta un flujo inexistente en formato libre y nunca sobrescribe una nota. Complete todos los campos antes de integrar el cambio.
