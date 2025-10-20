<%@ page language="java" import="java.util.*" %>
<%
    String ids = request.getParameter("ids");
%>
<html>
<head>
<title>BOM Composer</title>
  <meta charset="utf-8">
  <title>AgGridApp</title>
  <base href="/Windchill/rfa/trek/jsp/bomcomposer/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;margin:0;padding:0;background-color:#f8fafc;color:#1e293b}</style><link rel="stylesheet" href="styles-HYYKK674.css" media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="styles-HYYKK674.css"></noscript></head>
</head>
<body>
<div id="angular-root" data-bomid=<%= ids %> > </div>
<app-root></app-root>
<script src="polyfills-B6TNHZQ6.js" type="module"></script><script src="main-DWKWO4UK.js" type="module"></script></body>
<!-- You can add logic to display details or trigger actions for these IDs -->
</body>
</html>
