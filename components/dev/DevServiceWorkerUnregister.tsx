"use client";

import { useEffect } from "react";

/**
 * Este componente asegura que en modo de desarrollo ningún Service Worker
 * de una compilación de producción previa (PWA) quede activo, previniendo
 * problemas de carga de CSS (pantalla blanca) e inconsistencias en HMR.
 */
export function DevServiceWorkerUnregister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === "development" &&
      typeof window !== "undefined" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister().then((boolean) => {
            if (boolean) {
              console.log(
                "Service worker desregistrado exitosamente en desarrollo para prevenir problemas de caché CSS."
              );
              // Forzamos la limpieza del caché almacenado por el SW
              if (window.caches) {
                window.caches.keys().then((keyList) => {
                  return Promise.all(
                    keyList.map((key) => {
                      return window.caches.delete(key);
                    })
                  );
                });
              }
            }
          });
        }
      });
    }
  }, []);

  return null;
}
