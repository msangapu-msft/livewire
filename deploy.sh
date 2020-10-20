#!/bin/bash
cd ui
npm config set strict-ssl false
npm install
npm install
npm run build
