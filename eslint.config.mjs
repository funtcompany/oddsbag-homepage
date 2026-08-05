import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 맥이 외장 디스크에 자동으로 만드는 숨김 짝파일 (._파일명).
    // 코드가 아니라 검사에서 빼야 진짜 오류가 묻히지 않는다.
    "**/._*",
  ]),
]);

export default eslintConfig;
