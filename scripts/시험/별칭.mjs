// «@/» 별칭과 «.ts 확장자 생략» 을 node 에서도 알아듣게 하는 갈고리.
// 다음(Next)만 아는 규칙이라 서버 없이 시험하려면 이게 필요하다.
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import path from "node:path";

const 뿌리 = process.env.OB_ROOT;

registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith("@/")) {
      let p = path.join(뿌리, spec.slice(2));
      if (!fs.existsSync(p)) {
        for (const 끝 of [".ts", ".tsx", ".json", "/index.ts"]) {
          if (fs.existsSync(p + 끝)) { p += 끝; break; }
        }
      }
      return { url: pathToFileURL(p).href, shortCircuit: true };
    }
    return next(spec, ctx);
  },
});
