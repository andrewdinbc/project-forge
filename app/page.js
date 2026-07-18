"use client";
import Link from "next/link";

export default function HomePage() {
  return (
    <div style={{fontFamily:"'Segoe UI',sans-serif",padding:40,maxWidth:700,margin:"0 auto"}}>
      <h1 style={{color:"#1c3557"}}>🚀 project-forge</h1>
      <p style={{color:"#8a7d6e"}}>Full TPT bundle creation platform — generates, formats, and uploads educational resource packages.</p>
      <div style={{display:"flex", gap:12, marginTop:24}}>
        <Link href="/dashboard" style={{background:"#2563eb", color:"#fff", padding:"10px 20px", borderRadius:8, fontWeight:600, textDecoration:"none"}}>
          Go to Dashboard
        </Link>
        <Link href="/auth/login" style={{border:"1px solid #cbd5e1", color:"#1c3557", padding:"10px 20px", borderRadius:8, fontWeight:600, textDecoration:"none"}}>
          Sign In
        </Link>
      </div>
    </div>
  );
}
