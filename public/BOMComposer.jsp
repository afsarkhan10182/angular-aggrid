<%@page language="java"
       import="java.util.*,
               wt.org.WTUser,
               wt.session.SessionHelper,
               wt.util.WTProperties,
               com.lcs.wc.foundation.LCSQuery,
               com.lcs.wc.foundation.LCSRevisableEntity,
               com.lcs.wc.util.LCSProperties,
               org.apache.logging.log4j.Logger,
               org.apache.logging.log4j.LogManager,
               com.lcs.wc.util.FormatHelper"
%>

<%!
    public static final String JSPNAME = "BOMComposer";
    private static final Logger logger = LogManager.getLogger("rfa.trek.jsp.bomcomposer.BOMComposer");
	%>

<%
    String ids = request.getParameter("ids");
	System.out.println("ids = "+ids);
	String refSKU = request.getParameter("referenceSKU");
	String refSKUId = "";
	if(FormatHelper.hasContent(refSKU))
	{
	LCSRevisableEntity sku = (LCSRevisableEntity) LCSQuery.findObjectById(refSKU);
    refSKUId= sku.getName();
	}
	System.out.println("refSKUId = "+refSKUId);
    String bomType = request.getParameter("bomType");
	WTUser wtUser = (WTUser) SessionHelper.manager.getPrincipal();
	String userName = wtUser.getFullName();
	WTProperties wtproperties = WTProperties.getLocalProperties();
    String  windchillHost = wtproperties.getProperty("wt.rmi.server.hostname","");
%>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><%= bomType %> Composer</title>
  <base href="./">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
  <style>*{box-sizing:border-box;margin:0;padding:0}html,body{height:100%;margin:0;padding:0;overflow:hidden}body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background-color:#f8fafc;color:#1e293b}</style>
  <!-- ANGULAR_STYLES -->
</head>
<body>
  <div id="angular-root" data-bomid="<%= ids %>" data-username="<%= userName %>" data-host="<%= windchillHost %>" data-bomtype="<%= bomType %>" data-refskuid="<%= refSKUId %>"></div>
  <app-root></app-root>
  <!-- ANGULAR_SCRIPTS -->
</body>
</html>
