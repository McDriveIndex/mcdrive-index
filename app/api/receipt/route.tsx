import { ImageResponse } from "next/og";

export const runtime = "edge";

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
  const imageUrl = imagePath.startsWith("http") ? imagePath : `${origin}${imagePath}`;

  const frameUrl = `${origin}/receipt/frame.png`;

  const PAPER_WIDTH = 660;
  const PAPER_LEFT = Math.round((1080 - PAPER_WIDTH) / 2);
  const PAPER_TOP = 145;
  const PAPER_HEIGHT = 1350 - PAPER_TOP * 2;
  const nimbusRegular = await fetch(
    new URL("../../../public/fonts/NimbusSanL-Reg.ttf", import.meta.url)
  ).then((res) => res.arrayBuffer());

  const nimbusBold = await fetch(
    new URL("../../../public/fonts/NimbusSanL-Bol.ttf", import.meta.url)
  ).then((res) => res.arrayBuffer());

  function Separator() {
    return (
      <div style={{ width: "100%", borderTop: "3px dashed rgba(0,0,0,0.18)" }} />
    );
  }

  function LeaderRow(props: { label: string; value: string; labelOpacity?: number }) {
    const { label, value, labelOpacity = 0.65 } = props;
    return (
      <div style={{ width: "100%", display: "flex", flexDirection: "row", alignItems: "baseline" }}>
        <div style={{ fontSize: 22, opacity: labelOpacity }}>{label}</div>
        <div
          style={{
            flex: 1,
            borderBottom: "2px dashed rgba(0,0,0,0.35)",
            margin: "0 12px",
            transform: "translateY(-5px)",
          }}
        />
        <div style={{ fontSize: 22, fontWeight: 400 }}>{value}</div>
      </div>
    );
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
          src={frameUrl}
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
              fontSize: 52,
              fontWeight: 700,
              letterSpacing: -1,
              textTransform: "none",
              lineHeight: 1.05,
              marginBottom: 24,
            }}
          >
            McDrive Index™
          </div>

          <Separator />
          <div style={{ height: 24 }} />

          {/* BTC + DATE */}
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
            {LeaderRow({ label: "BTC PRICE", value: btc })}
            {LeaderRow({ label: "DATE", value: date })}
          </div>

          <div style={{ height: 22 }} />
          <div style={{ width: "100%", borderTop: "2px solid rgba(0,0,0,0.22)" }} />
          <div style={{ height: 22 }} />

          {/* ITEM */}
          <div style={{ width: "100%", fontSize: 24, fontWeight: 400, letterSpacing: 0.4 }}>
            ITEM
          </div>

          <div style={{ height: 12 }} />
          <Separator />
          <div style={{ height: 18 }} />

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
              src={imageUrl}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            />
          </div>

          <div style={{ height: 18 }} />

          {/* NAME + PRICE */}
          {LeaderRow({ label: name, value: price, labelOpacity: 1 })}

          <div style={{ height: 14 }} />
          <div style={{ width: "100%", borderTop: "2px solid rgba(0,0,0,0.22)" }} />
          <div style={{ height: 14 }} />

          {/* CHANGE */}
          {LeaderRow({ label: "CHANGE", value: change })}

          <div style={{ height: 18 }} />
          <div style={{ width: "100%", borderTop: "2px solid rgba(0,0,0,0.22)" }} />
          <div style={{ height: 18 }} />

          {/* TIER */}
          <div
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "center",
              textAlign: "center",
              fontSize: 36,
              fontWeight: 400,
              letterSpacing: 1.1,
            }}
          >
            {tierCopy}
          </div>

          <div style={{ height: 18 }} />
          <Separator />
          <div style={{ height: 16 }} />

          {/* EXTRA COPY */}
          {extraCopy ? (
            <div
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "center",
                textAlign: "center",
                fontSize: 26,
                opacity: 0.85,
                marginBottom: 16,
              }}
            >
              {extraCopy}
            </div>
          ) : (
            <div style={{ height: 10 }} />
          )}

          <Separator />
          <div style={{ height: 22 }} />

          {/* FOOTER */}
          <div
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "center",
              textAlign: "center",
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: -0.8,
              lineHeight: 1,
              marginTop: 26,
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
          data: nimbusRegular,
          style: "normal",
          weight: 400,
        },
        {
          name: "Nimbus",
          data: nimbusBold,
          style: "normal",
          weight: 700,
        },
      ],
    }
  );
}
