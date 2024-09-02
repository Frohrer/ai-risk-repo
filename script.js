let globalData = [];
let globalHeaders = [];
let globalDomains = {};
let globalSubDomains = {};

function parseCSV(str, delimiter = ",") {
	const rows = [];
	let currentRow = [];
	let currentField = "";
	let insideQuotes = false;

	for (let i = 0; i < str.length; i++) {
		const char = str[i];
		const nextChar = str[i + 1];

		if (char === '"') {
			if (insideQuotes && nextChar === '"') {
				// Double quotes inside a quoted field
				currentField += '"';
				i++; // Skip the next quote
			} else {
				// Toggle insideQuotes
				insideQuotes = !insideQuotes;
			}
		} else if (char === delimiter && !insideQuotes) {
			// End of field
			currentRow.push(currentField.trim());
			currentField = "";
		} else if (char === "\n" && !insideQuotes) {
			// End of row
			currentRow.push(currentField.trim());
			rows.push(currentRow);
			currentRow = [];
			currentField = "";
		} else {
			// Regular character, add to current field
			currentField += char;
		}
	}

	// Push the last field and row if there's any
	if (currentField) {
		currentRow.push(currentField.trim());
	}
	if (currentRow.length > 0) {
		rows.push(currentRow);
	}

	return rows;
}

function generateUniqueColor(index) {
	const hue = (index * 137.508) % 360;
	return `hsl(${hue}, 70%, 80%)`;
}

function processData(data) {
	const headers = data[0];
	const domainIndex = headers.indexOf("Domain");
	const subDomainIndex = headers.indexOf("Sub-domain");
	const categoryLevelIndex = headers.indexOf("Category level");

	globalDomains[""] = { color: "#FFFFFF" };
	globalSubDomains[""] = { color: "#FFFFFF" };

	return data
		.slice(1)
		.filter((row) => {
			const categoryLevel = row[categoryLevelIndex].toLowerCase();
			return categoryLevel !== "paper" && categoryLevel !== "additional evidence";
		})
		.map((row) => {
			const domain = row[domainIndex] || "";
			const subDomain = row[subDomainIndex] || "";

			if (!globalDomains[domain]) {
				globalDomains[domain] = {
					color: generateUniqueColor(Object.keys(globalDomains).length),
				};
			}

			if (!globalSubDomains[subDomain]) {
				globalSubDomains[subDomain] = {
					color: generateUniqueColor(Object.keys(globalSubDomains).length),
				};
			}

			return row;
		});
}

function formatChildRow(d) {
	console.log(d);
	return `
        <dl>
            <dt>Description:</dt>
            <dd>${d[10] || "N/A"}</dd>
			<dt>Technical Control:</dt>
            <dd>${d[19] || "N/A"}</dd>
            <dt>Additional Evidence:</dt>
            <dd>${d[11] || "N/A"}</dd>
            <dt>Source:</dt>
            <dd>${d[0] || "N/A"}</dd>
        </dl>
    `;
}

function getColorForValue(value) {
	value = value[0];
	switch (value) {
		case "1":
			return "danger";
		case "2":
			return "warning";
		case "3":
			return "secondary";
		case "4":
			return "info";
		default:
			return "primary";
	}
}

function createPill(text, color) {
	return `<span class="badge alert alert-${color}"><span class="">${text}</span></span>`;
}

function initializeDataTable() {
	const table = new DataTable("#data-table", {
		data: globalData,
		columns: [
			{
				className: "dt-control",
				orderable: false,
				data: null,
				defaultContent: "",
			},
			{ title: "Category level", data: 7 },
			{ title: "Risk category", data: 8 },
			{ title: "Risk subcategory", data: 9 },
			{
				title: "Entity",
				data: 14,
				render: function (data, type, row) {
					return createPill(data, getColorForValue(data));
				},
			},
			{
				title: "Intent",
				data: 15,
				render: function (data, type, row) {
					return createPill(data, getColorForValue(data));
				},
			},
			{
				title: "Timing",
				data: 16,
				render: function (data, type, row) {
					return createPill(data, getColorForValue(data));
				},
			},
			{ title: "Domain", data: 17, orderable: false },
			{ title: "Sub-domain", data: 18, orderable: false },
		],
		orderCellsTop: true,
		fixedHeader: true,
		paging: false,
		info: false,
		searching: true,
		dom: "Bfrtip",
		buttons: [
			{
				extend: "colvis",
				collectionLayout: "fixed columns",
				popoverTitle: "Column visibility control",
			},
		],
		layout: {
			topStart: {
				buttons: ["colvis"],
			},
		},
		initComplete: function (settings, json) {
			const api = this.api();

			// Create domain filter
			const domainSelect = $('<select><option value="">All Domains</option></select>')
				.appendTo($(api.column(7).header()).empty())
				.on("change", function () {
					const val = $(this).val();
					api
						.column(7)
						.search(val ? "^" + $.fn.dataTable.util.escapeRegex(val) + "$" : "", true, false)
						.draw();
					updateSubDomainFilter(api, val);
				});

			// Populate domain filter
			const domains = [...new Set(api.column(7).data().toArray())].sort();
			domains.forEach((domain) => {
				if (domain) {
					domainSelect.append('<option value="' + domain + '">' + domain + "</option>");
				}
			});

			console.log("Domains:", domains);

			// Create subdomain filter
			const subDomainSelect = $('<select><option value="">All Sub-domains</option></select>')
				.appendTo($(api.column(8).header()).empty())
				.on("change", function () {
					const val = $(this).val();
					api
						.column(8)
						.search(val ? "^" + $.fn.dataTable.util.escapeRegex(val) + "$" : "", true, false)
						.draw();
				});

			// Initial population of subdomain filter
			updateSubDomainFilter(api, "");
		},
		rowCallback: function (row, data, index) {
			const domain = data[17] || "";
			const backgroundColor = globalDomains[domain].color;
			$(row).css("background-color", `${backgroundColor}99`);
		},
		stripeClasses: ["odd", "even"],
		stripe: true,
	});

	// Add event listener for opening and closing details
	$("#data-table tbody").on("click", "td.dt-control", function () {
		var tr = $(this).closest("tr");
		var row = table.row(tr);

		if (row.child.isShown()) {
			row.child.hide();
			tr.removeClass("shown");
		} else {
			row.child(formatChildRow(row.data())).show();
			tr.addClass("shown");
		}
	});
}

function updateSubDomainFilter(api, selectedDomain) {
	console.log("Updating subdomain filter for domain:", selectedDomain);

	const subDomainColumn = api.column(8);
	const subDomainSelect = $(subDomainColumn.header()).find("select");

	subDomainSelect.empty().append('<option value="">All Sub-domains</option>');

	let subDomains;
	if (selectedDomain) {
		subDomains = api
			.column(8)
			.data()
			.filter((subDomain, index) => api.column(7).data()[index] === selectedDomain)
			.unique()
			.sort()
			.toArray();
	} else {
		subDomains = api.column(8).data().unique().sort().toArray();
	}

	console.log("Subdomains:", subDomains);

	subDomains.forEach((subDomain) => {
		if (subDomain) {
			subDomainSelect.append('<option value="' + subDomain + '">' + subDomain + "</option>");
		}
	});

	// Reset subdomain filter
	subDomainColumn.search("").draw();
}

function loadCSV() {
	fetch("csv.csv")
		.then((response) => response.text())
		.then((contents) => {
			const data = parseCSV(contents, ",");
			globalHeaders = data[0];
			globalData = processData(data);

			initializeDataTable();
		})
		.catch((error) => console.error("Error loading CSV file:", error));
}

document.addEventListener("DOMContentLoaded", () => {
	loadCSV();
});
