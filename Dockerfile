# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS client
WORKDIR /build/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api
WORKDIR /build
COPY src/SelfHostedAi.Api/SelfHostedAi.Api.csproj src/SelfHostedAi.Api/
RUN dotnet restore src/SelfHostedAi.Api/SelfHostedAi.Api.csproj
COPY src/ src/
RUN dotnet publish src/SelfHostedAi.Api -c Release -o /publish --no-restore /p:UseAppHost=false
COPY --from=client /build/client/dist /publish/wwwroot

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=api /publish ./
RUN mkdir -p /app/data /repositories && chown -R $APP_UID:$APP_UID /app/data /repositories
USER $APP_UID
ENV ASPNETCORE_HTTP_PORTS=8080 Lens__DataDirectory=/app/data Lens__RepositoryRoot=/repositories
EXPOSE 8080
ENTRYPOINT ["dotnet", "SelfHostedAi.Api.dll"]
