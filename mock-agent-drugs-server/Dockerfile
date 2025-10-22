FROM rust:1.75 as builder

WORKDIR /app
COPY Cargo.toml Cargo.lock* ./
COPY src ./src

RUN cargo build --release

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    libsqlite3-0 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/release/mock-agent-drugs-server .

ENV PORT=3001
ENV DATABASE_URL=sqlite:./mock-agent-drugs.db

EXPOSE 3001

CMD ["./mock-agent-drugs-server"]
