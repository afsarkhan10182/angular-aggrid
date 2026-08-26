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
			   com.lcs.wc.material.LCSMaterial,
			   com.lcs.wc.material.LCSMaterialColorQuery,
			   com.lcs.wc.db.FlexObject,
			   org.apache.commons.lang3.StringEscapeUtils,
               com.lcs.wc.util.FormatHelper"
%>

<%!
    public static final String JSPNAME = "BOMComposer";
    private static final Logger logger = LogManager.getLogger("rfa.trek.jsp.bomcomposer.BOMComposer");
	%>

<%
    String ids = request.getParameter("ids");
	String refSKU = request.getParameter("referenceSKU");
	String refSKUId = "";
	if (FormatHelper.hasContent(refSKU)) {
		LCSRevisableEntity sku = (LCSRevisableEntity) LCSQuery.findObjectById(refSKU);
        if (sku != null) {
            refSKUId = sku.getName();
		}
	}
    String bomType = request.getParameter("bomType");
	WTUser wtUser = (WTUser) SessionHelper.manager.getPrincipal();
	String userName = wtUser.getFullName();
	WTProperties wtproperties = WTProperties.getLocalProperties();
    String  windchillHost = wtproperties.getProperty("wt.rmi.server.hostname","");

    String pageTitle = "Product BOM Composer";
%>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><%= pageTitle %></title>
  <base href="./">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
  <style>*{box-sizing:border-box;margin:0;padding:0}html,body{height:100%;margin:0;padding:0;overflow:hidden}body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background-color:#f8fafc;color:#1e293b}</style>
  <!-- ANGULAR_STYLES -->
</head>
<body>
  <div id="angular-root" data-bomid="<%= StringEscapeUtils.escapeHtml4(ids) %>" data-username="<%= StringEscapeUtils.escapeHtml4(userName) %>" data-host="<%= StringEscapeUtils.escapeHtml4(windchillHost) %>" data-bomtype="<%= StringEscapeUtils.escapeHtml4(bomType) %>" data-refskuid="<%= StringEscapeUtils.escapeHtml4(refSKUId) %>"></div>
  <app-root></app-root>
  <!-- ANGULAR_SCRIPTS -->
</body>
</html>
