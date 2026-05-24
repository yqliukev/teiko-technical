PYTHON ?= python3
PIP ?= $(PYTHON) -m pip
FRONTEND_DIR := frontend

.PHONY: setup pipeline dashboard

setup:
	$(PIP) install -r requirements.txt
	cd $(FRONTEND_DIR) && npm install

pipeline:
	$(PYTHON) steps.py
	cp cell_count_summary.csv $(FRONTEND_DIR)/
	cp stat_test_results.json $(FRONTEND_DIR)/
	cp step_4_data.csv $(FRONTEND_DIR)/
	cp step_4_summary.json $(FRONTEND_DIR)/
	cp treatment_response_boxplot.png $(FRONTEND_DIR)/
	cp cell-count.csv $(FRONTEND_DIR)/

dashboard: pipeline
	cd $(FRONTEND_DIR) && npm run dev -- --host 0.0.0.0