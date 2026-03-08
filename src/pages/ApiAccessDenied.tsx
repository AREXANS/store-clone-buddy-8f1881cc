import { useSearchParams } from "react-router-dom";

const ApiAccessDenied = () => {
  const [params] = useSearchParams();
  const name = params.get("name") || "unknown";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#fff",
        fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,0,0,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,0,0,0.03) 1px,transparent 1px)",
          backgroundSize: "60px 60px",
          pointerEvents: "none",
        }}
      />

      {/* Glow blobs */}
      <div style={{ position:"absolute", width:300, height:300, borderRadius:"50%", filter:"blur(120px)", opacity:0.15, background:"#ff0000", top:"10%", left:"20%" }} />
      <div style={{ position:"absolute", width:300, height:300, borderRadius:"50%", filter:"blur(120px)", opacity:0.15, background:"#ff3333", bottom:"15%", right:"15%" }} />
      <div style={{ position:"absolute", width:200, height:200, borderRadius:"50%", filter:"blur(120px)", opacity:0.15, background:"#cc0000", top:"50%", left:"60%" }} />

      {/* Content */}
      <div style={{ textAlign:"center", zIndex:1, padding:"2rem", maxWidth:500 }}>
        <div
          style={{
            display:"inline-block",
            padding:"8px 24px",
            border:"1px solid rgba(255,60,60,0.4)",
            borderRadius:30,
            fontSize:13,
            letterSpacing:3,
            color:"#ff4444",
            marginBottom:28,
            background:"rgba(255,0,0,0.08)",
          }}
        >
          4 0 3 &nbsp; E R R O R
        </div>

        <h1 style={{ fontSize:"clamp(2.5rem,8vw,4rem)", fontWeight:300, marginBottom:20, lineHeight:1.1 }}>
          Access <strong style={{ fontWeight:700 }}>Denied</strong>
        </h1>

        <p style={{ color:"#888", fontSize:15, lineHeight:1.7, marginBottom:32 }}>
          You don't have permission to access this resource.<br />
          <span style={{ color:"#ff6666", fontWeight:500 }}>@arexans</span> only [browser_sec_headers]
        </p>

        <a
          href="/"
          style={{
            display:"inline-flex",
            alignItems:"center",
            gap:8,
            padding:"12px 28px",
            background:"rgba(255,50,50,0.12)",
            border:"1px solid rgba(255,60,60,0.3)",
            borderRadius:10,
            color:"#ff5555",
            fontSize:14,
            textDecoration:"none",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          Return Home
        </a>

        <div style={{ marginTop:40, color:"#444", fontSize:12, letterSpacing:1 }}>
          AREXANS SECURITY SYSTEM
        </div>
      </div>
    </div>
  );
};

export default ApiAccessDenied;
