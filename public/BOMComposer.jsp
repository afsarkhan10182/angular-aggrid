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

    String pageTitle = "Product BOM Composer";
	if ("EBOM".equals(bomType)) {
		pageTitle = "Material BOM Composer";
		
		String[] skuIDsColl = ids.split(",");
		StringBuilder idsBuilder = new StringBuilder();
		for (String skuId : skuIDsColl) {
			LCSMaterial material = (LCSMaterial) LCSQuery.findObjectById(skuId);
			Collection<FlexObject> skuList = new LCSMaterialColorQuery().findMaterialColorData(material).getResults();

			for (FlexObject skufo : skuList) {
				String id = skufo.getString("LCSMATERIALCOLOR.IDA2A2");
				System.out.println("skufo = " + skufo);
				if (idsBuilder.length() > 0) {
					idsBuilder.append(",");
				}
				idsBuilder.append("OR:com.lcs.wc.material.LCSMaterialColor:" + id);
			}
		}
		ids = idsBuilder.toString();
		System.out.println("BOMComposer.jsp ids = " + ids);
		
	} else if ("SBOM".equals(bomType)) {
		pageTitle = bomType + " Composer";
	} else if ("MATERIALSBOM".equals(bomType)) {
		pageTitle = "Material SBOM Composer";
	} else if ("MATERIALMBOM".equals(bomType)) {
		pageTitle = "Part MBOM Composer";
	}
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
  <div id="angular-root" data-bomid="<%= ids %>" data-username="<%= userName %>" data-host="<%= windchillHost %>" data-bomtype="<%= bomType %>" data-refskuid="<%= refSKUId %>"></div>
  <app-root></app-root>
  <!-- ANGULAR_SCRIPTS -->
</body>
</html>
