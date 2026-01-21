<%@page language="java"
       import="java.util.*,
               wt.org.WTUser,
               wt.session.SessionHelper,
               wt.util.WTProperties,
               com.lcs.wc.foundation.LCSQuery,
               com.lcs.wc.foundation.LCSRevisableEntity,
               com.lcs.wc.util.LCSProperties,
               org.apache.logging.log4j.Logger,
               org.apache.logging.log4j.LogManager"
%>

<%!
    public static final String JSPNAME = "BOMComposer";
    private static final Logger logger = LogManager.getLogger("rfa.trek.jsp.bomcomposer.BOMComposer");
	%>

<%
    String ids = request.getParameter("ids");
	System.out.println("ids = "+ids);
	String refSKU = request.getParameter("referenceSKU");
	LCSRevisableEntity sku = (LCSRevisableEntity) LCSQuery.findObjectById(refSKU);
	String refSKUId= sku.getName();
	System.out.println("refSKUId = "+refSKUId);
    String bomType = request.getParameter("bomType");
	WTUser wtUser = (WTUser) SessionHelper.manager.getPrincipal();
	String userName = wtUser.getFullName();
	WTProperties wtproperties = WTProperties.getLocalProperties();
    String  windchillHost = wtproperties.getProperty("wt.rmi.server.hostname","");
%>
<html>
<head>
<title>BOM Composer</title>
  <meta charset="utf-8">
  <title>AgGridApp</title>
  <base href="./">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
<style>*{box-sizing:border-box;margin:0;padding:0}html,body{height:100%;margin:0;padding:0;overflow:hidden}body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background-color:#f8fafc;color:#1e293b}</style><link rel="stylesheet" href="styles-JWFSWXJX.css" media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="styles-JWFSWXJX.css"></noscript></head>
<body>
<div id="angular-root" data-bomid="<%= ids %>" data-username="<%= userName %>" data-host="<%= windchillHost %>" data-bomtype="<%= bomType %>" data-refskuid="<%= refSKUId %>" data-isserviceteammember="<%= isServiceTeamMember %>" > </div>
<app-root></app-root>
<link rel="modulepreload" href="chunk-KK4UT7WN.js"><link rel="modulepreload" href="chunk-4CLCTAJ7.js"><script src="polyfills-B6TNHZQ6.js" type="module"></script><script src="main-YXMEOBZY.js" type="module"></script></body>
<!-- You can add logic to display details or trigger actions for these IDs -->
</body>
</html>