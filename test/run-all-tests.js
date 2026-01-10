#!/usr/bin/env node

/**
 * Test Runner - Executes all test files and aggregates results
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// ANSI color codes for terminal output
const colors = {
	reset: '\x1b[0m',
	green: '\x1b[32m',
	red: '\x1b[31m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	cyan: '\x1b[36m',
	gray: '\x1b[90m'
};

// Test files to run (in order)
const testFiles = [
	'test-login.js',
	'test-parse.js',
	'test-arenabg-parser.js',
	'test-search-by-title.js',
	'test-download-keys.js',
	'test-bulgarian-audio-flag.js',
	'test-resolution.js',
	'test-live-search.js'
];

// Check which test files actually exist
const existingTests = testFiles.filter(file => {
	const filePath = path.join(__dirname, file);
	return fs.existsSync(filePath);
});

console.log(`${colors.cyan}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
console.log(`${colors.cyan}║${colors.reset}          ${colors.blue}Stremio Addon Zamunda/ArenaBG Test Suite${colors.reset}         ${colors.cyan}║${colors.reset}`);
console.log(`${colors.cyan}╚════════════════════════════════════════════════════════════╝${colors.reset}\n`);

console.log(`${colors.gray}Found ${existingTests.length} test files to execute${colors.reset}\n`);

// Results tracking
const results = {
	total: 0,
	passed: 0,
	failed: 0,
	skipped: 0,
	testDetails: []
};

/**
 * Run a single test file
 * @param {string} testFile - Name of the test file
 * @returns {Promise<Object>} Test result
 */
function runTest(testFile) {
	return new Promise((resolve) => {
		const testPath = path.join(__dirname, testFile);
		const startTime = Date.now();
		
		console.log(`${colors.blue}▶${colors.reset} Running ${colors.cyan}${testFile}${colors.reset}...`);
		
		const testProcess = spawn('node', [testPath], {
			cwd: path.dirname(__dirname),
			env: process.env,
			shell: true
		});
		
		let stdout = '';
		let stderr = '';
		
		testProcess.stdout.on('data', (data) => {
			stdout += data.toString();
		});
		
		testProcess.stderr.on('data', (data) => {
			stderr += data.toString();
		});
		
		testProcess.on('close', (code) => {
			const duration = Date.now() - startTime;
			const durationSec = (duration / 1000).toFixed(2);
			
			const result = {
				file: testFile,
				passed: code === 0,
				duration: duration,
				stdout: stdout,
				stderr: stderr,
				exitCode: code
			};
			
			if (code === 0) {
				console.log(`  ${colors.green}✓${colors.reset} ${testFile} ${colors.gray}(${durationSec}s)${colors.reset}`);
				results.passed++;
			} else {
				console.log(`  ${colors.red}✗${colors.reset} ${testFile} ${colors.gray}(${durationSec}s)${colors.reset}`);
				console.log(`  ${colors.red}Exit code: ${code}${colors.reset}`);
				if (stderr) {
					console.log(`  ${colors.red}Error output:${colors.reset}`);
					stderr.split('\n').slice(0, 5).forEach(line => {
						if (line.trim()) console.log(`    ${colors.gray}${line}${colors.reset}`);
					});
				}
				results.failed++;
			}
			
			results.total++;
			results.testDetails.push(result);
			console.log(''); // Empty line for spacing
			
			resolve(result);
		});
		
		testProcess.on('error', (error) => {
			console.log(`  ${colors.red}✗${colors.reset} ${testFile} - ${colors.red}Failed to start: ${error.message}${colors.reset}\n`);
			results.failed++;
			results.total++;
			results.testDetails.push({
				file: testFile,
				passed: false,
				duration: 0,
				stdout: '',
				stderr: error.message,
				exitCode: -1
			});
			resolve({ file: testFile, passed: false });
		});
	});
}

/**
 * Run all tests sequentially
 */
async function runAllTests() {
	const overallStartTime = Date.now();
	
	for (const testFile of existingTests) {
		await runTest(testFile);
	}
	
	const overallDuration = Date.now() - overallStartTime;
	const overallDurationSec = (overallDuration / 1000).toFixed(2);
	
	// Print summary
	console.log(`${colors.cyan}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
	console.log(`${colors.cyan}║${colors.reset}                      ${colors.blue}Test Summary${colors.reset}                       ${colors.cyan}║${colors.reset}`);
	console.log(`${colors.cyan}╚════════════════════════════════════════════════════════════╝${colors.reset}\n`);
	
	console.log(`  Total Tests:    ${results.total}`);
	console.log(`  ${colors.green}Passed:${colors.reset}         ${results.passed}`);
	console.log(`  ${colors.red}Failed:${colors.reset}         ${results.failed}`);
	console.log(`  Duration:       ${overallDurationSec}s\n`);
	
	// Show failed tests details
	if (results.failed > 0) {
		console.log(`${colors.red}Failed Tests:${colors.reset}`);
		results.testDetails.filter(t => !t.passed).forEach(test => {
			console.log(`  ${colors.red}✗${colors.reset} ${test.file}`);
			if (test.stderr) {
				const errorLines = test.stderr.split('\n').filter(l => l.trim());
				errorLines.slice(0, 3).forEach(line => {
					console.log(`    ${colors.gray}${line}${colors.reset}`);
				});
			}
		});
		console.log('');
	}
	
	// Overall result
	if (results.failed === 0) {
		console.log(`${colors.green}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
		console.log(`${colors.green}║${colors.reset}              ${colors.green}✓ ALL TESTS PASSED${colors.reset}                        ${colors.green}║${colors.reset}`);
		console.log(`${colors.green}╚════════════════════════════════════════════════════════════╝${colors.reset}\n`);
		process.exit(0);
	} else {
		console.log(`${colors.red}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
		console.log(`${colors.red}║${colors.reset}              ${colors.red}✗ SOME TESTS FAILED${colors.reset}                       ${colors.red}║${colors.reset}`);
		console.log(`${colors.red}╚════════════════════════════════════════════════════════════╝${colors.reset}\n`);
		process.exit(1);
	}
}

// Run all tests
runAllTests().catch(error => {
	console.error(`${colors.red}Fatal error running tests:${colors.reset}`, error);
	process.exit(1);
});
