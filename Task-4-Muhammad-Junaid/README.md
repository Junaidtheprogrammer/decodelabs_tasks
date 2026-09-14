# Full-Stack Task Manager (Project 4 Integration Milestone)

A full-stack web application demonstrating dynamic frontend integration with a RESTful Express backend and persistent SQLite database storage. Built as part of the DecodeLabs curriculum.

## Project Overview

This project completes **Project 4: Frontend & Backend Integration**, connecting a static client UI with server-side logic and database persistence. It utilizes the Input-Process-Output (IPO) model to accept user input, process data asynchronously via a REST API, and dynamically render state updates safely in the browser.

## Features & Architecture

* **Input-Process-Output (IPO) Workflow**: Captures client inputs via HTML forms, processes data securely through Express controllers, and updates the DOM dynamically.
* **RESTful API**: Stateless operations mapped to HTTP methods (`GET`, `POST`, `DELETE`) with standard status codes (`200`, `201`, `400`, `404`, `500`).
* **Asynchronous Integration**: Uses modern JavaScript `async/await` syntax with native `fetch` API requests.
* **XSS Prevention**: Safe DOM construction using `document.createElement` and `textContent` properties instead of direct raw HTML string interpolation.
* **Defensive Error Handling**: Comprehensive validation on both client and server layers with visual status banner feedback for network or application errors.
* **Database Persistence**: Managed via SQLite (`better-sqlite3`) for quick, reliable relational data storage.

## Project Structure

```text
Task-4-Muhammad-Junaid/
├── .gitignore          # Git exclusion rules
├── README.md           # Documentation
├── package.json        # Node dependencies & script setup
├── schema.sql          # Relational database schema
├── database.js         # SQLite connection & schema initializer
├── server.js           # Express API server & static file host
└── public/
    ├── index.html      # UI structure & forms
    ├── styles.css      # Component styling & responsiveness
    └── app.js          # Asynchronous DOM controller & fetch logic