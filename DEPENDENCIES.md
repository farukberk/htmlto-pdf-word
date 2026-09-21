# Dependency inventory

## Widget

- Node.js 22.18.0 portable runtime for Mendix tooling; system Node.js 24.20.0 / npm 11.19.0 also detected
- `@mendix/pluggable-widgets-tools` 10.24.1
- React / React DOM 18.3.1
- TypeScript 5.9.2
- Vitest 3.2.4, jsdom 26.1.0, Testing Library 16.3.0 (development/test only)

## Java

- Eclipse Temurin JDK 21 (compiled with Java 17 release compatibility)
- Apache FreeMarker 2.3.34
- Jackson Databind 2.19.2
- OpenHTMLtoPDF PDFBox 1.0.10
- jsoup 1.18.3 (safe HTML-to-DOM normalization for OpenHTMLtoPDF)
- A locally installed Microsoft Edge, Google Chrome, or Chromium executable (preferred PDF renderer; not downloaded at runtime)
- JUnit Jupiter 5.13.4 (test only)
- Maven plugins: Surefire 3.5.3, JAR 3.4.2, Shade 3.6.0

Dependencies are downloaded only through npm/Maven-compatible package repositories. Runtime conversion is local and performs no document upload.
