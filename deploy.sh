#!/bin/bash

error_handler() {
    echo "ERROR: Произошла ошибка в строке $1. Скрипт аварийно завершен."
    # Здесь можно добавить cleanup: удаление временных файлов и т.д.
    exit 1
}

# trap "error_handler $LINENO" ERR означает: при ошибке (ERR)
# выполнить команду "error_handler $LINENO".
# $LINENO подставит номер строки, где произошла ошибка.
trap "error_handler $LINENO" ERR

cd /home/clients/notes

echo "%GIT PULL%"
git pull 2>&1

echo "%NPM CI%"
npm ci 2>&1

echo "%NPM BUILD%"
npm run build 2>&1

echo "END"