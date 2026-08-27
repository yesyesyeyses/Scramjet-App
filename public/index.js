"use strict";
/**
 * @type {HTMLFormElement}
 */
const form = document.getElementById("sj-form");
/**
 * @type {HTMLInputElement}
 */
const address = document.getElementById("sj-address");
/**
 * @type {HTMLInputElement}
 */
const searchEngine = document.getElementById("sj-search-engine");
/**
 * @type {HTMLParagraphElement}
 */
const error = document.getElementById("sj-error");
/**
 * @type {HTMLPreElement}
 */
const errorCode = document.getElementById("sj-error-code");
const landing = document.querySelector("main");
const footer = document.querySelector("footer");
const tabStrip = document.getElementById("tab-strip");
const newTabButton = document.getElementById("new-tab");
const closeAllButton = document.getElementById("close-all");
const browserAddress = document.getElementById("browser-address");
const tabs = [];
let activeTab = null;

const { ScramjetController } = $scramjetLoadController();

const scramjet = new ScramjetController({
	files: {
		wasm: "/scram/scramjet.wasm.wasm",
		all: "/scram/scramjet.all.js",
		sync: "/scram/scramjet.sync.js",
	},
});

scramjet.init();

const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

function showLanding() {
	activeTab = null;
	document.body.classList.remove("has-active-tab");
	document.body.classList.remove("show-chrome");
	landing.hidden = false;
	if (footer) footer.hidden = false;
	browserAddress.hidden = true;
	address.value = "";
	for (const tab of tabs) {
		tab.frame.style.display = "none";
		tab.button.classList.remove("active");
	}
	address.focus();
}

function activateTab(tab) {
	activeTab = tab;
	document.body.classList.add("has-active-tab");
	landing.hidden = true;
	if (footer) footer.hidden = true;
	browserAddress.hidden = false;
	browserAddress.textContent = tab.url;
	for (const item of tabs) {
		item.frame.style.display = item === tab ? "block" : "none";
		item.button.classList.toggle("active", item === tab);
	}
}

function addTab(frame, url) {
	const wrapper = document.createElement("div");
	wrapper.className = "tab-item";
	const button = document.createElement("button");
	button.type = "button";
	button.className = "tab-button";
	button.textContent = new URL(url).hostname.replace(/^www\./, "");
	button.title = url;
	const closeButton = document.createElement("button");
	closeButton.type = "button";
	closeButton.className = "close-tab";
	closeButton.setAttribute("aria-label", "Close tab");
	closeButton.textContent = "x";
	const tab = { button, frame: frame.frame, url, wrapper };
	button.addEventListener("click", () => activateTab(tab));
	closeButton.addEventListener("click", (event) => {
		event.stopPropagation();
		const index = tabs.indexOf(tab);
		tab.frame.remove();
		tab.wrapper.remove();
		tabs.splice(index, 1);
		closeAllButton.hidden = tabs.length === 0;
		if (activeTab === tab) {
			const nextTab = tabs[index] || tabs[index - 1];
			nextTab ? activateTab(nextTab) : showLanding();
		}
	});
	wrapper.append(button, closeButton);
	tabStrip.insertBefore(wrapper, closeAllButton);
	tabs.push(tab);
	closeAllButton.hidden = false;
	activateTab(tab);
}

newTabButton.addEventListener("click", showLanding);
closeAllButton.addEventListener("click", () => {
	for (const tab of tabs) {
		tab.frame.remove();
		tab.wrapper.remove();
	}
	tabs.length = 0;
	closeAllButton.hidden = true;
	showLanding();
});
document.addEventListener("mousemove", (event) => {
	if (!document.body.classList.contains("has-active-tab")) return;
	const rightEdge = window.innerWidth - 10;
	const chromeWidth = 205;
	const revealZoneStart = window.innerWidth - chromeWidth;
	if (event.clientX >= rightEdge || (document.body.classList.contains("show-chrome") && event.clientX >= revealZoneStart)) {
		document.body.classList.add("show-chrome");
	} else if (event.clientX < revealZoneStart) {
		document.body.classList.remove("show-chrome");
	}
});

form.addEventListener("submit", async (event) => {
	event.preventDefault();
	error.textContent = "";
	errorCode.textContent = "";

	try {
		await registerSW();
		const url = search(address.value.trim(), searchEngine.value);

		let wispUrl =
			(location.protocol === "https:" ? "wss" : "ws") +
			"://" +
			location.host +
			"/wisp/";
		if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
			await connection.setTransport("/libcurl/index.mjs", [
				{ websocket: wispUrl },
			]);
		}
		const frame = scramjet.createFrame();
		frame.frame.id = `sj-frame-${tabs.length + 1}`;
		frame.frame.classList.add("sj-frame");
		document.body.appendChild(frame.frame);
		addTab(frame, url);
		frame.go(url);
	} catch (err) {
		error.textContent = "Could not open that address.";
		errorCode.textContent = err.toString();
		showLanding();
	}
});
