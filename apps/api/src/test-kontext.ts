/**
 * Test FLUX Kontext character consistency
 *
 * Run: npx tsx src/test-kontext.ts
 */

import { imageGenerator } from './services/imageGenerator';

async function testKontextConsistency() {
  console.log('=== FLUX Kontext Character Consistency Test ===\n');

  // 1. Generate character reference portrait
  console.log('Step 1: Generating character reference portrait...');
  const characterDescription = 'young woman with red hair in a bun, freckles, brown eyes, athletic build, wearing olive military uniform with brass buttons';

  const referenceUrl = await imageGenerator.generateCharacterReference(
    characterDescription,
    'american comic book' // Match your comic style
  );
  console.log(`✓ Reference created: ${referenceUrl}\n`);

  // 2. Generate multiple panels with the same character using Kontext
  const scenes = [
    'The person is sitting at a desk writing documents, serious expression, office interior',
    'The person is standing and looking shocked at a paper in her hands, dramatic lighting',
    'The person is walking through a busy port with ships in background, determined expression',
    'Close-up of the person\'s face showing concern, rain drops on window behind',
  ];

  console.log('Step 2: Generating panels with character consistency...\n');

  for (let i = 0; i < scenes.length; i++) {
    console.log(`Panel ${i + 1}: "${scenes[i].substring(0, 50)}..."`);

    try {
      const result = await imageGenerator.generate({
        prompt: scenes[i],
        referenceImage: referenceUrl,
        provider: 'flux-kontext',
        aspectRatio: i === 3 ? '1:1' : '3:4', // Close-up as square
      });

      console.log(`✓ Generated: ${result.imageUrl}\n`);
    } catch (error) {
      console.error(`✗ Failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    }

    // Small delay between requests
    if (i < scenes.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log('\n=== Test Complete ===');
  console.log('Check the generated images in apps/api/public/images/');
  console.log('Compare character consistency between panels.');
}

testKontextConsistency().catch(console.error);
