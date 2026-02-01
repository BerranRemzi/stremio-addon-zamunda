const ArenaBGMovieParser = require('../src/parsers/arenabg-movie-parser');

const parser = new ArenaBGMovieParser();

console.log('Testing Resolution Extraction:');
console.log('='.repeat(50));

const testCases = [
	'Sing 2 2021 1080p BluRay x265 AAC BG+ENAUDiO SiSO',
	'Sing 2 2021 720p WEBRip x264',
	'Sing 2 2021 2160p UHD BluRay x265 10bit HDR DTS HD MA TrueHD 7 1',
	'Movie 4K HDR',
	'Movie 480p DVDRip',
	'Just a movie title'
];

testCases.forEach(title => {
	const resolution = parser.extractResolution(title);
	console.log(`\nTitle: ${title}`);
	console.log(`Resolution: ${resolution}`);
});

console.log('\n' + '='.repeat(50));
