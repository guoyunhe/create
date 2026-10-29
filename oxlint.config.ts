import { defineConfig } from 'oxlint';
import recommended from 'oxlint-config-recommended';
import recommendedUnicorn from 'oxlint-config-recommended/unicorn';

export default defineConfig({
  extends: [recommended, recommendedUnicorn],
});
