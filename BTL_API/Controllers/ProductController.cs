using Microsoft.AspNetCore.Mvc;

namespace BTL_API.Controllers
{
    public class ProductController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }

        public IActionResult Detail(string id)
        {
            ViewData["ProductID"] = id;
            return View();
        }
    }
}
