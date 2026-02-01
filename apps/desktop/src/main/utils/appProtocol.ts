import { net, protocol } from "electron"
import { isAbsolute, relative, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import {
  APP_PROTOCOL_HOST,
  APP_PROTOCOL_SCHEME,
} from "../constants/security"

export const registerAppProtocolPrivileges = (): void => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_PROTOCOL_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
      },
    },
  ])
}

export const registerAppProtocolHandler = (bundleRootDir: string): void => {
  protocol.handle(APP_PROTOCOL_SCHEME, (req) => {
    const { host, pathname } = new URL(req.url)

    if (host !== APP_PROTOCOL_HOST) {
      return new Response("Not found", { status: 404 })
    }

    const normalizedPathname = pathname === "/" ? "/index.html" : pathname
    const pathToServe = resolve(bundleRootDir, "." + normalizedPathname)
    const relativePath = relative(bundleRootDir, pathToServe)
    const isSafe =
      relativePath.length > 0 &&
      !relativePath.startsWith("..") &&
      !isAbsolute(relativePath)

    if (!isSafe) {
      return new Response("Bad request", { status: 400 })
    }

    return net.fetch(pathToFileURL(pathToServe).toString())
  })
}

