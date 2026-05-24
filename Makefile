PYTHON ?= python3
PIP ?= $(PYTHON) -m pip
FRONTEND_DIR := frontend

.PHONY: setup pipeline dashboard

setup:
	$(PIP) install -r requirements.txt
	cd $(FRONTEND_DIR) && npm install

pipeline:
	$(PYTHON) steps.py

dashboard: pipeline
	cd $(FRONTEND_DIR) && npm run dev -- --host 0.0.0.0