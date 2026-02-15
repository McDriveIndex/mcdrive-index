import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import path from "path";
import { readFile } from "fs/promises";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const date = searchParams.get("date") ?? "—";
  const btc = searchParams.get("btc") ?? "—";
  const name = searchParams.get("name") ?? "—";
  const price = searchParams.get("price") ?? "—";
  const change = searchParams.get("change") ?? "—";
  const tierCopy = searchParams.get("tierCopy") ?? "—";
  const extraCopy = searchParams.get("extraCopy") ?? "";
  const origin = new URL(req.url).origin;
  const imagePath = searchParams.get("image") ?? "/cars/placeholder.jpg";

  const PAPER_WIDTH = 660;
  const PAPER_LEFT = Math.round((1080 - PAPER_WIDTH) / 2);
  const PAPER_TOP = 163;
  const PAPER_HEIGHT = 1350 - PAPER_TOP * 2;

  function toDataUrl(buf: Buffer, mime: string) {
    return `data:${mime};base64,${buf.toString("base64")}`;
  }

  function guessMime(s: string) {
    const u = s.toLowerCase();
    if (u.endsWith(".png")) return "image/png";
    if (u.endsWith(".webp")) return "image/webp";
    return "image/jpeg";
  }

  async function readPublicFile(publicPath: string) {
    const abs = path.join(process.cwd(), "public", publicPath.replace(/^\//, ""));
    return readFile(abs);
  }

  function Separator() {
    return <div style={{ width: "100%", borderTop: "3px dashed rgba(0,0,0,0.18)" }} />;
  }

  function LeaderRow(props: {
    label: string;
    value: string;
    labelOpacity?: number;
    valueOpacity?: number;
    labelSize?: number;
    valueSize?: number;
    labelWeight?: number;
    valueWeight?: number;
    labelUppercase?: boolean;
    labelLetterSpacing?: number;
  }) {
    const {
      label,
      value,
      labelOpacity = 0.72,
      valueOpacity = 0.92,
      labelSize = 15,
      valueSize = 15,
      labelWeight = 500,
      valueWeight = 700,
      labelUppercase = false,
      labelLetterSpacing,
    } = props;
    const labelStyle: React.CSSProperties = {
      fontSize: labelSize,
      opacity: labelOpacity,
      fontWeight: labelWeight,
      textTransform: labelUppercase ? "uppercase" : "none",
    };

    if (labelLetterSpacing != null) {
      labelStyle.letterSpacing = `${labelLetterSpacing}px`;
    }

    return (
      <div style={{ width: "100%", display: "flex", flexDirection: "row", alignItems: "baseline" }}>
        <div style={labelStyle}>{label}</div>
        <div
          style={{
            flex: 1,
            borderBottom: "2px dashed rgba(0,0,0,0.35)",
            margin: "0 12px",
            transform: "translateY(-3px)",
          }}
        />
        <div style={{ fontSize: valueSize, fontWeight: valueWeight, opacity: valueOpacity }}>
          {value}
        </div>
      </div>
    );
  }

  try {
    const nimbusRegular = await readPublicFile("/fonts/NimbusSanL-Reg.ttf");
    const nimbusBold = await readPublicFile("/fonts/NimbusSanL-Bol.ttf");

    const frameBuf = await readPublicFile("/receipt/frame.png");
    const frameDataUrl = toDataUrl(frameBuf, "image/png");

    const placeholderBuf = await readPublicFile("/cars/placeholder.jpg");
    const placeholderDataUrl = toDataUrl(placeholderBuf, "image/jpeg");

    let carDataUrl = placeholderDataUrl;
    try {
      if (imagePath.startsWith("/")) {
        const carBuf = await readPublicFile(imagePath);
        carDataUrl = toDataUrl(carBuf, guessMime(imagePath));
      } else if (imagePath.startsWith("http")) {
        const ab = await fetch(imagePath).then((r) => {
          if (!r.ok) throw new Error(`Failed to fetch ${imagePath}: ${r.status}`);
          return r.arrayBuffer();
        });
        carDataUrl = toDataUrl(Buffer.from(ab), guessMime(imagePath));
      } else {
        const imageUrl = `${origin}${imagePath}`;
        const ab = await fetch(imageUrl).then((r) => {
          if (!r.ok) throw new Error(`Failed to fetch ${imageUrl}: ${r.status}`);
          return r.arrayBuffer();
        });
        carDataUrl = toDataUrl(Buffer.from(ab), guessMime(imageUrl));
      }
    } catch (e) {
      console.error("[receipt] car fetch failed, using placeholder", e);
    }

    return new ImageResponse(
      (
        <div
          style={{
            width: "1080px",
            height: "1350px",
            position: "relative",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            backgroundColor: "#fdfdfd",
            paddingTop: 120,
          }}
        >
          {/* FRAME BACKGROUND */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={frameDataUrl}
            style={{ position: "absolute", inset: 0, width: "1080px", height: "1350px" }}
          />

          {/* PAPER CONTENT (NO SCALE) */}
          <div
            style={{
              position: "absolute",
              top: `${PAPER_TOP}px`,
              left: `${PAPER_LEFT}px`,
              width: `${PAPER_WIDTH}px`,
              height: `${PAPER_HEIGHT}px`,
              display: "flex",
              flexDirection: "column",
              boxSizing: "border-box",
              padding: "26px 26px",
              overflow: "hidden",
              alignItems: "stretch",
              lineHeight: 1.15,
              justifyContent: "flex-start",
              fontFamily: "Nimbus",
              color: "#111111",
            }}
          >
            {/* HEADER */}
            <div
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "center",
                textAlign: "center",
                fontSize: 56,
                fontWeight: 700,
                letterSpacing: -1,
                textTransform: "none",
                lineHeight: 1.05,
                marginBottom: 34,
              }}
            >
              McDrive Index™
            </div>

            <Separator />
            <div style={{ height: 36 }} />

            {/* BTC + DATE */}
            <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>
              {LeaderRow({
                label: "BTC PRICE",
                value: btc,
                labelSize: 20,
                valueSize: 21,
                labelWeight: 400,
                valueWeight: 700,
                labelUppercase: true,
                labelLetterSpacing: 1.6,
                labelOpacity: 0.82,
                valueOpacity: 1,
              })}
              <div style={{ height: 14 }} />
              {LeaderRow({
                label: "DATE",
                value: date,
                labelSize: 20,
                valueSize: 21,
                labelWeight: 400,
                valueWeight: 700,
                labelUppercase: true,
                labelLetterSpacing: 1.6,
                labelOpacity: 0.82,
                valueOpacity: 1,
              })}
            </div>

            <div style={{ height: 20 }} />
            <div style={{ width: "100%", borderTop: "2px solid rgba(0,0,0,0.22)" }} />
            <div style={{ height: 18 }} />

            {/* ITEM */}
            <div
              style={{
                width: "100%",
                marginTop: 0,
                fontSize: 18,
                fontWeight: 400,
                letterSpacing: "1.6px",
                textTransform: "uppercase",
                opacity: 0.82,
              }}
            >
              ITEM
            </div>

            <div style={{ height: 10 }} />
            <Separator />
            <div style={{ height: 16 }} />

            {/* IMAGE */}
            <div
              style={{
                width: "100%",
                height: "380px",
                borderRadius: "18px",
                overflow: "hidden",
                background: "#ffffff",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={carDataUrl}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
            </div>

            <div style={{ height: 30 }} />

            {/* NAME + PRICE */}
            {LeaderRow({
              label: name,
              value: price,
              labelOpacity: 1,
              valueOpacity: 1,
              labelSize: 22,
              valueSize: 21,
              labelWeight: 500,
              valueWeight: 700,
              labelUppercase: true,
              labelLetterSpacing: 1.0,
            })}

            <div style={{ height: 18 }} />
            <div style={{ width: "100%", borderTop: "2px solid rgba(0,0,0,0.22)" }} />
            <div style={{ height: 16 }} />

            {/* CHANGE */}
            {LeaderRow({
              label: "CHANGE",
              value: change,
              labelSize: 20,
              valueSize: 21,
              labelWeight: 400,
              valueWeight: 700,
              labelOpacity: 0.82,
              valueOpacity: 0.95,
            })}

            <div style={{ height: 16 }} />
            <div style={{ width: "100%", borderTop: "2px solid rgba(0,0,0,0.22)" }} />
            <div style={{ height: 16 }} />

            {/* TIER */}
            <div
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "center",
                textAlign: "center",
                marginTop: 6,
                marginBottom: 6,
                fontSize: 25,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "1.2px",
              }}
            >
              {tierCopy}
            </div>

            <div style={{ height: 14 }} />
            <Separator />
            <div style={{ height: 12 }} />

            {/* EXTRA COPY */}
            {extraCopy ? (
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "center",
                  textAlign: "center",
                  fontSize: 27,
                  lineHeight: 1.18,
                  opacity: 0.9,
                  marginBottom: 12,
                }}
              >
                {extraCopy}
              </div>
            ) : (
              <div style={{ height: 8 }} />
            )}

            <Separator />
            <div style={{ height: 18 }} />

            {/* FOOTER */}
            <div
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "center",
                textAlign: "center",
                fontSize: 36,
                fontWeight: 700,
                letterSpacing: "0.6px",
                lineHeight: 1,
                marginTop: 18,
              }}
            >
              i’m drivin’ it™
            </div>
          </div>
        </div>
      ),
      {
        width: 1080,
        height: 1350,
        fonts: [
          {
            name: "Nimbus",
            data: nimbusRegular.buffer.slice(
              nimbusRegular.byteOffset,
              nimbusRegular.byteOffset + nimbusRegular.byteLength
            ),
            style: "normal",
            weight: 400,
          },
          {
            name: "Nimbus",
            data: nimbusBold.buffer.slice(
              nimbusBold.byteOffset,
              nimbusBold.byteOffset + nimbusBold.byteLength
            ),
            style: "normal",
            weight: 700,
          },
        ],
      }
    );
  } catch (error) {
    const details =
      error instanceof Error ? error.stack ?? error.message : String(error);

    console.error("[api/receipt] Failed to render PNG receipt", error);

    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json(
        { error: "Failed to render PNG receipt", details },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to render PNG receipt" },
      { status: 500 }
    );
  }
}
