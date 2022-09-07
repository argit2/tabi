#run vite build first
rm -r ./dist-firefox/*
cp -a ./dist/. ./dist-firefox
cp -a ./public-firefox/. ./dist-firefox