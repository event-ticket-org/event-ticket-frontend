# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /build

# The lockfile alone first, so editing a component does not reinstall node_modules.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Which payment provider this build asks for.
#
# Baked in, because that is the mechanism a static client has: `import.meta.env` is replaced
# at build time, so the answer is a property of the bundle rather than of the container. That
# means a different provider is a different image, which is the honest trade here and not a
# limitation worth engineering around - the real fix is the contract learning to report which
# providers a deployment has, and anything built to work around it now would be deleted then.
# See src/features/checkout/payment-provider.ts and DESIGN.md's Known Gaps.
ARG VITE_PAYMENT_PROVIDER=FAKE
ENV VITE_PAYMENT_PROVIDER=${VITE_PAYMENT_PROVIDER}

# `npm run build` regenerates src/api/schema.d.ts from the vendored contract and typechecks
# against it before Vite runs, so an image cannot be built from code that has fallen behind
# contracts/openapi.yaml.
RUN npm run build

FROM nginx:1.27-alpine

COPY --from=build /build/dist /usr/share/nginx/html
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# Substituted into the template at start-up. The default is the service name a compose file
# would use; a deployment behind its own proxy points it wherever the backend actually is.
ENV BACKEND_ORIGIN=http://backend:8080

EXPOSE 80
